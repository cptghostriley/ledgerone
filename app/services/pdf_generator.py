import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class PDFReportGenerator:
    def __init__(self, client_data: dict, recon_data: dict, deadlines_data: list):
        self.client_data = client_data
        self.recon_data = recon_data
        self.deadlines_data = deadlines_data

    def generate(self) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=40, leftMargin=40,
                                topMargin=40, bottomMargin=40)
        
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        h2_style = styles['Heading2']
        normal_style = styles['Normal']
        
        elements = []
        
        # Title
        elements.append(Paragraph(f"Client Report: {self.client_data.get('name', 'Unknown')}", title_style))
        elements.append(Paragraph(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
        elements.append(Spacer(1, 20))
        
        # Metadata
        elements.append(Paragraph("Client Profile", h2_style))
        profile_data = [
            ["PAN", self.client_data.get('pan', 'N/A')],
            ["GSTIN", self.client_data.get('gstin', 'N/A')],
        ]
        t = Table(profile_data, colWidths=[100, 300])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Reconciliation
        elements.append(Paragraph("Reconciliation Summary", h2_style))
        recon = self.recon_data
        if recon:
            recon_table = [
                ["Status", recon.get("status", "N/A")],
                ["Flagged Checks", str(recon.get("flags", 0))]
            ]
            rt = Table(recon_table, colWidths=[150, 250])
            rt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(rt)
        else:
            elements.append(Paragraph("No reconciliation data available.", normal_style))
        elements.append(Spacer(1, 20))
        
        # Deadlines
        elements.append(Paragraph("Upcoming Deadlines", h2_style))
        if self.deadlines_data:
            dl_data = [["Type", "Due Date", "Status"]]
            for d in self.deadlines_data:
                dl_data.append([d['type'], d['date'], d['status']])
            dt = Table(dl_data, colWidths=[150, 150, 100])
            dt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(dt)
        else:
            elements.append(Paragraph("No upcoming deadlines.", normal_style))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.read()
