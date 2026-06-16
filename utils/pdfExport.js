import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportSinglePDF = (q) => {
    const doc = new jsPDF();
    
    // Background
    doc.setFillColor(20, 20, 25);
    doc.rect(0, 0, 210, 297, 'F');
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(255, 71, 87);
    doc.text('LAPORAN GETARAN GEMPA', 105, 40, { align: 'center' });
    
    doc.setDrawColor(255, 71, 87);
    doc.setLineWidth(1);
    doc.line(40, 45, 170, 45);
    
    // Location
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Lokasi: ${q.location}`, 105, 60, { align: 'center' });
    
    // Magnitude
    doc.setFontSize(60);
    doc.setTextColor(255, 71, 87);
    doc.text(`${q.magnitude}`, 105, 100, { align: 'center' });
    doc.setFontSize(20);
    doc.text('SR', 130, 100);
    
    // Attributes
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(14);
    let y = 130;
    const items = [
        { label: 'Waktu Kejadian', value: `${q.date} ${q.time}` },
        { label: 'Kedalaman', value: `${q.depth} km` },
        { label: 'Latitude', value: q.lat.toFixed(6) },
        { label: 'Longitude', value: q.lng.toFixed(6) },
    ];
    
    items.forEach(item => {
        doc.setFontSize(12);
        doc.setTextColor(150, 150, 150);
        doc.text(item.label, 105, y, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text(item.value, 105, y + 8, { align: 'center' });
        y += 25;
    });
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('GeoQuake Monitor - Jember Area System', 105, 270, { align: 'center' });

    doc.save(`Gempa_${q.location.replace(/ /g, '_')}_${q.time.replace(/:/g, '')}.pdf`);
};

export const exportHistoryPDF = (earthquakes) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Riwayat Getaran Gempa - Wilayah Jember', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);

    const tableColumn = ["Waktu", "Lokasi", "Magnitudo", "Kedalaman", "Koordinat"];
    const tableRows = [];

    earthquakes.forEach(q => {
      const quakeData = [
        `${q.date} ${q.time}`,
        q.location,
        `${q.magnitude} SR`,
        `${q.depth} km`,
        `${q.lat.toFixed(4)}, ${q.lng.toFixed(4)}`
      ];
      tableRows.push(quakeData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [255, 71, 87] },
      styles: { fontSize: 9 }
    });

    doc.save(`Riwayat_Gempa_Jember_${Date.now()}.pdf`);
};
