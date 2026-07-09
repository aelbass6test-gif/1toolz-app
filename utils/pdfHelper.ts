import html2pdf from 'html2pdf.js';
import DOMPurify from 'dompurify';

export async function exportHTMLToPDF(elementOrHtml: HTMLElement | string, orientation: 'portrait' | 'landscape' = 'landscape', filename: string = 'report.pdf', isContinuous: boolean = false) {
    let container: HTMLElement;
    let shouldCleanup = false;

    if (typeof elementOrHtml === 'string') {
        container = document.createElement('div');
        container.className = 'pdf-container';
        // Ensure the HTML string is wrapped in a container with explicit white background for rendering and sanitized with DOMPurify
        // Explicitly allow <style> tags so report styles are not stripped
        const sanitizedHtml = DOMPurify.sanitize(elementOrHtml, { ADD_TAGS: ['style'], ADD_ATTR: ['style'] });
        // Replace oklab/oklch colors with a fallback to avoid PDF export error
        const cleanHtml = convertOklchAndOklabToRgb(sanitizedHtml);
        container.innerHTML = `<div class="pdf-inner-wrapper" style="background: white !important; width: 100%; height: auto !important; min-height: auto !important; overflow: visible !important; padding: 20px; font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${cleanHtml}</div>`;
        
        // Use visible but off-screen positioning to ensure browser renders it fully
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = orientation === 'landscape' ? '297mm' : '210mm';
        container.style.height = 'auto';
        container.style.minHeight = 'auto';
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';
        container.style.zIndex = '-9999';
        container.style.background = 'white';
        container.style.opacity = '1';
        document.body.appendChild(container);
        shouldCleanup = true;
    } else {
        container = elementOrHtml.cloneNode(true) as HTMLElement;
        
        // Ensure white background
        container.style.background = 'white';
        
        // Position it off-screen
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = orientation === 'landscape' ? '297mm' : '210mm';
        container.style.zIndex = '-9999';
        
        document.body.appendChild(container);
        
        // Fast cleanup of direct inline styles on cloned elements
        cleanInlineStyles(container);
        
        shouldCleanup = true;
    }

    const originalGetComputedStyle = window.getComputedStyle;
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;

    // Temporarily patch window.getComputedStyle during PDF generation
    (window as any).getComputedStyle = function (elt: Element, pseudoElt?: string) {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        return new Proxy(style, {
            get(target, prop) {
                if (prop === 'getPropertyValue') {
                    return function(propertyName: string) {
                        const value = target.getPropertyValue(propertyName);
                        if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
                            return convertOklchAndOklabToRgb(value);
                        }
                        return value;
                    };
                }
                
                let value;
                try {
                    value = Reflect.get(target, prop, target);
                } catch (e) {
                    return undefined;
                }

                if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
                    return convertOklchAndOklabToRgb(value);
                }
                if (typeof value === 'function') {
                    return value.bind(target);
                }
                return value;
            }
        });
    };

    // Temporarily patch CSSStyleDeclaration.prototype.getPropertyValue during PDF generation
    CSSStyleDeclaration.prototype.getPropertyValue = function(property: string) {
        const value = originalGetPropertyValue.call(this, property);
        if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
            return convertOklchAndOklabToRgb(value);
        }
        return value;
    };

    try {
        // Extra wait for any internal browser rendering/fonts/styles before measuring and exporting
        await new Promise(resolve => setTimeout(resolve, 1500));

        const widthMm = orientation === 'landscape' ? 297 : 210;
        let formatOption: any = 'a4';
        
        if (isContinuous) {
            // Measure exact container height after browser rendering
            const innerWrapper = container.querySelector('.pdf-inner-wrapper') as HTMLElement || container;
            const containerHeightPx = Math.max(
                innerWrapper.scrollHeight,
                innerWrapper.offsetHeight,
                innerWrapper.getBoundingClientRect().height,
                container.scrollHeight,
                container.offsetHeight,
                500
            );
            // Convert px to mm (1 inch = 96 px = 25.4 mm) and add safety margin so it never splits into multiple pages
            let calculatedHeightMm = Math.max(widthMm, Math.ceil((containerHeightPx * 25.4) / 96) + 30);
            
            // jsPDF max size is 14400 points = 5080 mm. If it exceeds, cap it to avoid breaking or throwing.
            if (calculatedHeightMm > 5080) {
                calculatedHeightMm = 5080;
            }
            formatOption = [widthMm, calculatedHeightMm];
        }

        const opt = {
            margin:       isContinuous ? [0, 0, 0, 0] as [number, number, number, number] : [10, 10, 10, 10] as [number, number, number, number],
            filename:     filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            pagebreak:    isContinuous ? { mode: [] } : { mode: 'css' },
            html2canvas:  { 
                scale: 3, 
                useCORS: true, 
                letterRendering: true, 
                backgroundColor: '#ffffff',
                logging: false,
                removeContainer: true,
                windowWidth: orientation === 'landscape' ? 1122 : 794
            },
            jsPDF:        { 
                unit: 'mm' as const, 
                format: formatOption, 
                orientation: orientation as 'portrait' | 'landscape',
                compress: true,
                precision: 16
            }
        };

        await html2pdf().set(opt).from(container).save();
    } finally {
        // Restore original functions
        (window as any).getComputedStyle = originalGetComputedStyle;
        CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;

        if (shouldCleanup && container.parentNode) {
            document.body.removeChild(container);
        }
    }
}

// OKLAB to RGB Conversion Formulas
function oklabToRgbString(L: number, a: number, b: number, A: number): string {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b_val = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const gamma = (x: number) => {
        return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    };

    const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
    const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
    const B = Math.max(0, Math.min(255, Math.round(gamma(b_val) * 255)));

    if (A === 1) {
        return `rgb(${R}, ${G}, ${B})`;
    } else {
        return `rgba(${R}, ${G}, ${B}, ${A})`;
    }
}

function oklchToRgb(match: string, content: string): string {
    const parts = content.trim().split(/[\s,/]+/);
    if (parts.length < 3) return 'rgb(0,0,0)';
    
    const L_str = parts[0];
    const C_str = parts[1];
    const H_str = parts[2];
    const A_str = parts[3] || '1';
    
    let L = L_str.endsWith('%') ? parseFloat(L_str) / 100 : parseFloat(L_str);
    let C = C_str.endsWith('%') ? parseFloat(C_str) / 100 : parseFloat(C_str);
    let H = parseFloat(H_str);
    let A = A_str.endsWith('%') ? parseFloat(A_str) / 100 : parseFloat(A_str);
    
    if (isNaN(L)) L = 0;
    if (isNaN(C)) C = 0;
    if (isNaN(H)) H = 0;
    if (isNaN(A)) A = 1;
    
    const h_rad = (H * Math.PI) / 180;
    const a = C * Math.cos(h_rad);
    const b = C * Math.sin(h_rad);
    
    return oklabToRgbString(L, a, b, A);
}

function oklabToRgb(match: string, content: string): string {
    const parts = content.trim().split(/[\s,/]+/);
    if (parts.length < 3) return 'rgb(0,0,0)';
    
    const L_str = parts[0];
    const a_str = parts[1];
    const b_str = parts[2];
    const A_str = parts[3] || '1';
    
    let L = L_str.endsWith('%') ? parseFloat(L_str) / 100 : parseFloat(L_str);
    let a = a_str.endsWith('%') ? parseFloat(a_str) / 100 : parseFloat(a_str);
    let b = b_str.endsWith('%') ? parseFloat(b_str) / 100 : parseFloat(b_str);
    let A = A_str.endsWith('%') ? parseFloat(A_str) / 100 : parseFloat(A_str);
    
    if (isNaN(L)) L = 0;
    if (isNaN(a)) a = 0;
    if (isNaN(b)) b = 0;
    if (isNaN(A)) A = 1;
    
    return oklabToRgbString(L, a, b, A);
}

function convertOklchAndOklabToRgb(str: string): string {
    if (!str || typeof str !== 'string') return str;
    let result = str;
    result = result.replace(/oklch\(([^)]+)\)/g, oklchToRgb);
    result = result.replace(/oklab\(([^)]+)\)/g, oklabToRgb);
    return result;
}

function cleanInlineStyles(el: HTMLElement) {
    if (el.style) {
        for (let i = 0; i < el.style.length; i++) {
            const property = el.style[i];
            const value = el.style.getPropertyValue(property);
            if (typeof value === 'string' && (value.includes('oklch') || value.includes('oklab'))) {
                el.style.setProperty(property, convertOklchAndOklabToRgb(value));
            }
        }
    }
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
        cleanInlineStyles(children[i] as HTMLElement);
    }
}
