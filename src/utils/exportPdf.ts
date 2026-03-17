import { ExamResult, Question, Certification } from '@/types/exam';

export function exportExamResultPDF(
  result: ExamResult,
  questions: Question[],
  cert: Certification,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  const primary: [number, number, number] = [0, 170, 210];
  const accent: [number, number, number] = [16, 185, 129];
  const danger: [number, number, number] = [220, 80, 80];
  const muted: [number, number, number] = [120, 130, 145];

  // ── Header ──
  doc.setFillColor(15, 20, 30);
  doc.rect(0, 0, pageW, 44, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('CertGym - Exam Results', margin, y + 6);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primary);
  doc.text(`${cert.provider} | ${cert.name} (${cert.code})`, margin, y + 16);

  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Generated: ${new Date().toLocaleString('vi-VN')}`, margin, y + 24);

  y = 52;

  // ── Score Summary Box ──
  const boxH = 32;
  doc.setFillColor(20, 28, 40);
  doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, 'F');

  const scoreColor = result.passed ? accent : danger;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${result.percentage}%`, margin + 8, y + 18);

  doc.setFontSize(12);
  doc.text(result.passed ? 'PASSED' : 'NOT PASSED', margin + 38, y + 18);

  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const mins = Math.floor(result.timeTaken / 60);
  const secs = result.timeTaken % 60;
  const statsText = `Score: ${result.score}/${result.total}  |  Time: ${mins}m ${secs.toString().padStart(2, '0')}s  |  Pass mark: ${cert.passingScore || 70}%`;
  doc.text(statsText, margin + 8, y + 26);

  y += boxH + 10;

  // ── Domain Breakdown ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 50);
  doc.text('Domain Breakdown', margin, y);
  y += 6;

  const domainRows = Object.entries(result.domainBreakdown).map(([domain, data]) => {
    const pct = Math.round((data.correct / data.total) * 100);
    return [domain, `${data.correct}/${data.total}`, `${pct}%`, pct >= (cert.passingScore || 70) ? 'Pass' : 'Fail'];
  });

  autoTable(doc, {
    startY: y,
    head: [['Domain', 'Score', '%', 'Status']],
    body: domainRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 20, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 80 },
      3: { fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = data.cell.raw === 'Pass' ? [...accent] : [...danger];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Questions Detail ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 50);
  doc.text('Questions Review', margin, y);
  y += 6;

  const qRows = questions.map((q, idx) => {
    const qr = result.questionResults.find((r) => r.questionId === q.id);
    const wasSkipped = !qr || qr.selectedAnswers.length === 0;
    const isCorrect = qr?.correct ?? false;

    const selectedLabels = q.choices
      .filter((c) => qr?.selectedAnswers.includes(c.id))
      .map((c) => c.label.toUpperCase())
      .join(', ') || '-';

    const correctLabels = q.choices
      .filter((c) => qr?.correctAnswers.includes(c.id))
      .map((c) => c.label.toUpperCase())
      .join(', ');

    const status = wasSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Wrong';

    return [`Q${idx + 1}`, q.title.length > 60 ? q.title.slice(0, 57) + '...' : q.title, selectedLabels, correctLabels, status];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Question', 'Your Answer', 'Correct', 'Result']],
    body: qRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 20, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = data.cell.raw as string;
        if (val === 'Correct') data.cell.styles.textColor = [...accent];
        else if (val === 'Wrong') data.cell.styles.textColor = [...danger];
        else data.cell.styles.textColor = [200, 160, 40];
      }
    },
  });

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      `CertGym | Page ${i}/${totalPages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  doc.save(`CertGym_${cert.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
