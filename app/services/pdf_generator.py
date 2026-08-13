import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class PDFReportGenerator:
    def __init__(self, report_data: dict[str, Any]):
        self.report_data = report_data

    def _section_title(self, text: str, styles: dict[str, ParagraphStyle]) -> Paragraph:
        return Paragraph(text, styles["Heading2"])

    def _kv_table(self, rows: list[list[Any]]) -> Table:
        table = Table(rows, colWidths=[180, 320], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e7ecf5")),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1f2937")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return table

    def _render_mapping_section(self, title: str, mapping: dict[str, Any], styles: dict[str, ParagraphStyle], elements: list[Any]) -> None:
        elements.append(self._section_title(title, styles))
        if not mapping:
            elements.append(Paragraph("No data available.", styles["Normal"]))
            return

        rows = [[Paragraph(f"<b>{key}</b>", styles["Normal"]), Paragraph(self._format_value(value), styles["Normal"])] for key, value in mapping.items()]
        elements.append(self._kv_table(rows))

    def _format_value(self, value: Any) -> str:
        if value is None:
            return "N/A"
        if isinstance(value, (dict, list)):
            return f"<font name='Courier'>{self._escape(str(value))}</font>"
        return self._escape(str(value))

    def _escape(self, value: str) -> str:
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def generate(self) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=42,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="ReportMeta", parent=styles["Normal"], fontSize=9, leading=12, textColor=colors.HexColor("#4b5563")))

        client_profile = self.report_data.get("client_profile", {})
        documents = self.report_data.get("documents", {})
        deadlines = self.report_data.get("deadlines", [])
        missing_documents = self.report_data.get("missing_documents", [])
        reconciliation = self.report_data.get("reconciliation", {})
        period_lock = self.report_data.get("period_lock")
        history = self.report_data.get("history", [])
        generated_at = datetime.utcnow().isoformat(timespec="seconds")

        elements: list[Any] = []

        elements.append(Paragraph(f"Client Report: {self._escape(client_profile.get('name', 'Unknown Client'))}", styles["Title"]))
        elements.append(Paragraph(f"Generated at: {generated_at} UTC", styles["ReportMeta"]))
        elements.append(Spacer(1, 14))

        self._render_mapping_section(
            "Client Profile",
            {
                "PAN": client_profile.get("pan"),
                "GSTIN": client_profile.get("gstin"),
                "Filing type": client_profile.get("filing_type"),
                "Assessment year": client_profile.get("ay"),
                "Contact info": client_profile.get("contact_info"),
                "Metadata": client_profile.get("metadata"),
            },
            styles,
            elements,
        )
        elements.append(Spacer(1, 12))

        self._render_mapping_section(
            "Document Summary",
            {
                "Total documents": documents.get("total"),
                "Processed": documents.get("processed"),
                "Pending": documents.get("pending"),
                "Review": documents.get("review"),
                "Failed": documents.get("failed"),
            },
            styles,
            elements,
        )

        latest_documents = documents.get("latest", [])
        if latest_documents:
            elements.append(Spacer(1, 8))
            elements.append(self._section_title("Latest Documents", styles))
            doc_rows = [["Filename", "Type", "FY", "Status", "Confidence"]]
            for item in latest_documents:
                doc_rows.append(
                    [
                        self._escape(str(item.get("filename", ""))),
                        self._escape(str(item.get("doc_type", ""))),
                        self._escape(str(item.get("financial_year", ""))),
                        self._escape(str(item.get("status", ""))),
                        f"{(item.get('confidence') or 0):.2f}",
                    ]
                )
            table = Table(doc_rows, colWidths=[190, 95, 60, 70, 65])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(table)

        elements.append(Spacer(1, 12))
        self._render_mapping_section(
            "Reconciliation Overview",
            {
                "Bank total": reconciliation.get("bank", {}).get("total"),
                "Bank matched": reconciliation.get("bank", {}).get("matched"),
                "Bank unmatched": reconciliation.get("bank", {}).get("unmatched"),
                "Ledger total": reconciliation.get("ledger", {}).get("total"),
                "Ledger matched": reconciliation.get("ledger", {}).get("matched"),
                "Ledger unmatched": reconciliation.get("ledger", {}).get("unmatched"),
                "Latest lock": period_lock.get("month_year") if period_lock else None,
            },
            styles,
            elements,
        )

        latest_recon = reconciliation.get("latest_results", [])
        if latest_recon:
            elements.append(Spacer(1, 8))
            elements.append(self._section_title("Latest Recon Results", styles))
            recon_rows = [["FY", "Status", "Flags", "Created At"]]
            for item in latest_recon:
                recon_rows.append(
                    [
                        self._escape(str(item.get("financial_year", ""))),
                        self._escape(str(item.get("status", ""))),
                        str(item.get("flagged_count", 0)),
                        self._escape(str(item.get("created_at", ""))),
                    ]
                )
            table = Table(recon_rows, colWidths=[100, 100, 70, 220])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            elements.append(table)

        if missing_documents:
            elements.append(Spacer(1, 12))
            elements.append(self._section_title("Missing Documents", styles))
            rows = [["Document", "Required For", "Status", "Due Date"]]
            for item in missing_documents:
                rows.append(
                    [
                        self._escape(str(item.get("document_type", ""))),
                        self._escape(str(item.get("required_for", ""))),
                        self._escape(str(item.get("status", ""))),
                        self._escape(str(item.get("due_date", ""))),
                    ]
                )
            table = Table(rows, colWidths=[200, 100, 80, 140])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            elements.append(table)

        if deadlines:
            elements.append(Spacer(1, 12))
            elements.append(self._section_title("Upcoming Deadlines", styles))
            rows = [["Type", "Due Date", "Status", "Notes"]]
            for item in deadlines:
                rows.append(
                    [
                        self._escape(str(item.get("type", ""))),
                        self._escape(str(item.get("due_date", ""))),
                        self._escape(str(item.get("status", ""))),
                        self._escape(str(item.get("notes", ""))),
                    ]
                )
            table = Table(rows, colWidths=[90, 110, 70, 210])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            elements.append(table)

        if history:
            elements.append(Spacer(1, 12))
            elements.append(self._section_title("Recent Q&A Activity", styles))
            rows = [["Role", "Session", "Message", "Timestamp"]]
            for item in history[:6]:
                rows.append(
                    [
                        self._escape(str(item.get("role", ""))),
                        self._escape(str(item.get("session_name", ""))),
                        self._escape(str(item.get("content", "")))[:120],
                        self._escape(str(item.get("created_at", ""))),
                    ]
                )
            table = Table(rows, colWidths=[55, 105, 215, 95])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            elements.append(table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.read()
