document.getElementById('download-pdf').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const reportContent = document.getElementById('report-content');
    
    html2canvas(reportContent, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("NWP-Tourism-Recommendations.pdf");
    });
});