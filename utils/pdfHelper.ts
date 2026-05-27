import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportHTMLToPDF(html: string, orientation: 'portrait' | 'landscape', filename: string, isContinuous: boolean = false) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.width = orientation === 'landscape' ? '297mm' : '210mm';
    container.style.backgroundColor = 'white';
    container.style.position = 'fixed';
    container.style.left = '-9999px'; // Changed from -99999px to avoid some browser rendering limits
    container.style.top = '0';
    container.style.zIndex = '-9999';
    document.body.appendChild(container);

    try {
        await new Promise(r => setTimeout(r, 300)); // Increased delay to ensure fonts/images load
        
        const dataUrl = await htmlToImage.toPng(container, { backgroundColor: '#ffffff', pixelRatio: 2 });
        
        if (isContinuous) {
            // Calculate height in mm
            const heightPx = container.scrollHeight;
            const widthPx = container.scrollWidth;
            const widthMm = orientation === 'landscape' ? 297 : 210;
            const heightMm = (heightPx * widthMm) / widthPx;

            const pdf = new jsPDF(orientation, 'mm', [widthMm, heightMm]);
            pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm);
            pdf.save(filename);
        } else {
            const pdf = new jsPDF(orientation, 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps = pdf.getImageProperties(dataUrl);
            const imgWidth = pdfWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(filename);
        }
    } finally {
        document.body.removeChild(container);
    }
}
