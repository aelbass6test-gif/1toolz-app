import html2pdf from 'html2pdf.js';

export async function exportHTMLToPDF(elementOrHtml: HTMLElement | string, orientation: 'portrait' | 'landscape' = 'landscape', filename: string = 'report.pdf', isContinuous: boolean = false) {
    let container: HTMLElement;
    let shouldCleanup = false;

    if (typeof elementOrHtml === 'string') {
        container = document.createElement('div');
        container.className = 'pdf-container';
        // Ensure the HTML string is wrapped in a container with explicit white background for rendering
        container.innerHTML = `<div style="background: white !important; width: 100%; min-height: 100%; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${elementOrHtml}</div>`;
        
        // Use visible but off-screen positioning to ensure browser renders it fully
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = orientation === 'landscape' ? '297mm' : '210mm';
        container.style.zIndex = '-9999';
        container.style.background = 'white';
        container.style.opacity = '1';
        document.body.appendChild(container);
        shouldCleanup = true;
    } else {
        container = elementOrHtml;
    }

    try {
        const opt = {
            margin:       [10, 10, 10, 10] as [number, number, number, number],
            filename:     filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { 
                scale: 3, 
                useCORS: true, 
                letterRendering: true, 
                backgroundColor: '#ffffff',
                logging: false,
                removeContainer: true
            },
            jsPDF:        { 
                unit: 'mm' as const, 
                format: isContinuous ? [orientation === 'landscape' ? 297 : 210, 800] as [number, number] : 'a4', 
                orientation: orientation as 'portrait' | 'landscape',
                compress: true,
                precision: 16
            }
        };

        // Extra wait for any internal browser rendering/fonts/styles
        await new Promise(resolve => setTimeout(resolve, 1500));

        await html2pdf().set(opt).from(container).save();
    } finally {
        if (shouldCleanup && container.parentNode) {
            document.body.removeChild(container);
        }
    }
}
