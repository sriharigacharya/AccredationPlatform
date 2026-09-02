# Report Generation Service (`report-service`)

Microservice responsible for assembling structured National Board of Accreditation (NBA) Self-Assessment Reports (SAR) and ad-hoc analytical reports.

## Supported Formats & Trees

- **SAR Format**: `ug_tier_ii_gapc_v4` (UG Tier-II GAPC Version 4.0, January 2025)
- **Document Output**: PDF (via WeasyPrint / CSS Paged Media) and DOCX (via `python-docx`).

## Implementation Status & Roadmap Note

> [!NOTE]
> The full 9-criterion, 1000-mark SAR tree (`sar_tree/ug_tier_ii_gapc_v4.py`) is structured to enforce mathematical mark integrity across all nodes.
> Currently, **Criterion 4** ("Students' Performance & Activities", Sections 4.1 through 4.6.3) has complete live formulas, dynamic event summary sheets, photo attachments, and data service integrations.

> Criteria 1–3 and 5–9 serve as structural nodes and placeholders laying the foundation for future full-SAR compiler extensions.

## Access Control & Endpoints

| Endpoint | Methods | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `/reports/nba/generate` | `POST` | `Admin`, `Teacher` | Generate structured NBA SAR report |
| `/reports/generate` | `POST` | `Admin`, `Teacher` | Alias for report generation |
| `/reports/clubs-activities/summary-sheets` | `GET` | `Admin`, `Teacher` | Bulk Summary Sheet data for report assembly |
| `/reports/history` | `GET` | `Admin`, `Teacher`, `Student` | List previously generated reports |
| `/reports/:id/download` | `GET` | `Admin`, `Teacher`, `Student` | Stream PDF/DOCX report artifacts |
| `/reports/adhoc` | `POST` | `Admin`, `Teacher`, `Student` | Generate ad-hoc grounded analytical report |

## Event Summary Sheets & No-Omission Rule (Criterion 4.6.1)

- **Layer 1 (Compact Table)**: All mentor-approved events for the assessment period appear unconditionally.
- **Layer 2 (Detailed Summary Sheets)**: Only events passed in `include_event_ids` render full summary sheets with PO mappings, resource persons, outcomes, and photographs.
