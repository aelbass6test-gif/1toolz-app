export const printPdfBlob = (blobUrl: string, filename: string = 'bosta-awb.pdf') => {
    try {
        const win = window.open(blobUrl, '_blank');
        if (win) {
            try {
                win.focus();
            } catch (_) {}
            return;
        }
    } catch (e) {
        console.warn("window.open blocked or restricted for PDF blob:", e);
    }

    // Fallback: Trigger direct download / open via anchor tag
    try {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            try {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
            } catch (_) {}
        }, 1500);
    } catch (err) {
        console.error("Failed to download or open PDF blob:", err);
    }
};

export const printHTMLDirectly = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);
    
    try {
        const documentObj = iframe.contentDocument || iframe.contentWindow?.document;
        if (documentObj) {
            documentObj.open();
            documentObj.write(html);
            documentObj.close();
            
            setTimeout(() => {
                try {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                    }
                } catch (printErr) {
                    console.warn("iframe contentWindow.print failed:", printErr);
                }
                
                // Cleanup after a delay
                setTimeout(() => {
                    try {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    } catch (_) {}
                }, 5000);
            }, 600);
        } else {
            throw new Error("Cannot get iframe document object directly");
        }
    } catch (e) {
        console.warn("Enhanced frame printing failed, falling back to window.open style", e);
        try {
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                setTimeout(() => {
                    try {
                        win.focus();
                        win.print();
                    } catch (_) {}
                }, 500);
            }
        } catch (_) {}
    }
};
