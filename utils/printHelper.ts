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
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    
                    // Cleanup after a delay
                    setTimeout(() => {
                        try {
                            if (document.body.contains(iframe)) {
                                document.body.removeChild(iframe);
                            }
                        } catch (err) {}
                    }, 5000); // Wait longer for the print dialog to finish
                }
            }, 600);
        } else {
            throw new Error("Cannot get iframe document object directly");
        }
    } catch (e) {
        console.warn("Enhanced frame printing failed, falling back to window.open style", e);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقريرات المعتمدة.');
        }
    }
};
