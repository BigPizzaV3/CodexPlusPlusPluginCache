"""Reusable synthetic fixtures for Career Centre v4 tests."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def load_persona(name: str = "senior_transformation") -> dict[str, Any]:
    return json.loads((ROOT / "evaluations" / "personas" / f"{name}.json").read_text(encoding="utf-8"))


def role_dossier(*, decision: str = "apply", synthetic: bool = True) -> dict[str, Any]:
    skip_reason = "The role fails a hard compensation gate." if decision == "skip" else None
    return {
        "schema_version": "4.0",
        "role_id": "ROLE-SYNTH-001",
        "track": "Enterprise transformation",
        "decision": decision,
        "fit_score": 8.6 if decision == "apply" else 5.2,
        "shortlist_chance_percent": 48 if decision == "apply" else 15,
        "salary": {
            "band": "AUD 190,000–220,000 package",
            "basis": "estimated",
            "currency": "AUD",
            "evidence_note": "Synthetic benchmark fixture; not a live salary claim."
        },
        "employment": {
            "type": "permanent",
            "duration": None,
            "deprioritisation_note": None
        },
        "identity": {
            "company": "Atlas Services",
            "title": "Director, Enterprise Transformation",
            "location": "Melbourne, Australia",
            "exact_posting_url": "https://jobs.example.org/postings/atlas-transformation-001",
            "source": "Synthetic evaluation fixture",
            "external_job_id": "ATLAS-001",
            "posting_status": "open" if decision != "skip" else "closed",
            "link_status": "verified_exact" if decision != "skip" else "unverified",
            "checked_at": "2026-07-14T09:30:00+08:00",
            "content_fingerprint": "sha256:synthetic-atlas-001",
            "synthetic": synthetic
        },
        "recruiter_contact": None,
        "main_match": "Direct operating-model leadership with workforce-technology adoption evidence.",
        "main_risk": "The role may favour candidates with more direct ownership of a global P&L.",
        "cv_angle": "Lead with operating-model scale, governance and practical AI-adoption evidence.",
        "recommended_cv_base": "Executive ATS",
        "add_to_tracker": decision != "skip",
        "skip_reason": skip_reason,
        "requirement_map": [
            {
                "requirement": "Lead enterprise operating-model transformation",
                "importance": "essential",
                "assessment": "direct",
                "evidence_ids": ["EV-P01-001"],
                "gap_note": None
            },
            {
                "requirement": "Establish program governance and adoption",
                "importance": "essential",
                "assessment": "direct",
                "evidence_ids": ["EV-P01-002"],
                "gap_note": None
            },
            {
                "requirement": "Translate generative AI into workforce practice",
                "importance": "important",
                "assessment": "adjacent",
                "evidence_ids": ["EV-P01-003"],
                "gap_note": "Prototype evidence is credible but not enterprise product ownership."
            },
            {
                "requirement": "Senior cross-sector transformation leadership",
                "importance": "important",
                "assessment": "direct",
                "evidence_ids": ["EV-P01-004"],
                "gap_note": None
            }
        ]
    }


def midcareer_role_dossier() -> dict[str, Any]:
    return {
        "schema_version": "4.0",
        "role_id": "ROLE-SYNTH-CA-001",
        "track": "Customer operations transformation",
        "decision": "maybe",
        "fit_score": 7.7,
        "shortlist_chance_percent": 38,
        "salary": {
            "band": "CAD 125,000–140,000 annualised equivalent",
            "basis": "annualised-contract-estimate",
            "currency": "CAD",
            "evidence_note": "Synthetic fixed-term evaluation fixture."
        },
        "employment": {
            "type": "fixed-term",
            "duration": "12 months",
            "deprioritisation_note": "A credible match, but the 12-month term is less attractive than the candidate's permanent preference."
        },
        "identity": {
            "company": "MapleGrid Services",
            "title": "Senior Manager, Customer Operations Transformation",
            "location": "Toronto, Canada",
            "exact_posting_url": "https://jobs.example.org/postings/maplegrid-operations-001",
            "source": "Synthetic evaluation fixture",
            "external_job_id": "MAPLEGRID-001",
            "posting_status": "open",
            "link_status": "verified_exact",
            "checked_at": "2026-07-14T10:00:00-04:00",
            "content_fingerprint": "sha256:synthetic-maplegrid-001",
            "synthetic": True
        },
        "recruiter_contact": None,
        "main_match": "Direct customer-operations leadership, workflow improvement and service-performance routines.",
        "main_risk": "Fixed-term employment and no evidence of enterprise analytics-platform ownership.",
        "cv_angle": "Lead with the 45-person function, complaint-resolution result and practical service routines.",
        "recommended_cv_base": "Professional ATS",
        "add_to_tracker": True,
        "skip_reason": None,
        "requirement_map": [
            {
                "requirement": "Lead a multi-team customer operations function",
                "importance": "essential",
                "assessment": "direct",
                "evidence_ids": ["EV-P02-001"],
                "gap_note": None
            },
            {
                "requirement": "Deliver measurable service improvement",
                "importance": "essential",
                "assessment": "direct",
                "evidence_ids": ["EV-P02-002"],
                "gap_note": None
            },
            {
                "requirement": "Create performance routines and service metrics",
                "importance": "important",
                "assessment": "direct",
                "evidence_ids": ["EV-P02-003"],
                "gap_note": "Evidence supports operating metrics, not enterprise analytics ownership."
            }
        ]
    }


def earlycareer_role_dossier() -> dict[str, Any]:
    return {
        "schema_version": "4.0",
        "role_id": "ROLE-SYNTH-UK-001",
        "track": "Digital marketing and CRM",
        "decision": "apply",
        "fit_score": 7.9,
        "shortlist_chance_percent": 35,
        "salary": {
            "band": "GBP 35,000–42,000",
            "basis": "listed",
            "currency": "GBP",
            "evidence_note": "Synthetic listed band for evaluation only."
        },
        "employment": {
            "type": "permanent",
            "duration": None,
            "deprioritisation_note": None
        },
        "identity": {
            "company": "Northlight Media",
            "title": "CRM and Digital Marketing Coordinator",
            "location": "Manchester, United Kingdom",
            "exact_posting_url": "https://jobs.example.org/postings/northlight-crm-001",
            "source": "Synthetic evaluation fixture",
            "external_job_id": "NORTHLIGHT-001",
            "posting_status": "open",
            "link_status": "verified_exact",
            "checked_at": "2026-07-14T15:00:00+01:00",
            "content_fingerprint": "sha256:synthetic-northlight-001",
            "synthetic": True
        },
        "recruiter_contact": None,
        "main_match": "Direct internship exposure to email, web updates and reporting plus a relevant analytics project.",
        "main_risk": "Evidence is early-career and does not support independent campaign ownership.",
        "cv_angle": "Present hands-on support and learning agility while keeping the capstone clearly labelled as a university project.",
        "recommended_cv_base": "Professional ATS one-page",
        "add_to_tracker": True,
        "skip_reason": None,
        "requirement_map": [
            {
                "requirement": "Support email and web campaigns",
                "importance": "essential",
                "assessment": "direct",
                "evidence_ids": ["EV-P03-001"],
                "gap_note": None
            },
            {
                "requirement": "Use campaign data for reporting",
                "importance": "essential",
                "assessment": "adjacent",
                "evidence_ids": ["EV-P03-002"],
                "gap_note": "Evidence is from a university project rather than commercial campaign ownership."
            },
            {
                "requirement": "Relevant marketing qualification",
                "importance": "important",
                "assessment": "direct",
                "evidence_ids": ["EV-P03-003"],
                "gap_note": None
            }
        ]
    }


def earlycareer_application_pack() -> dict[str, Any]:
    persona = load_persona("earlycareer_marketing")
    return {
        "schema_version": "4.0",
        "candidate": {
            "name": persona["profile"]["name"],
            "headline": persona["profile"]["headline"],
            "contact": [
                {"text": persona["profile"]["location"], "url": None},
                {"text": "Email", "url": persona["profile"]["contact"][0]["url"]}
            ]
        },
        "role": earlycareer_role_dossier(),
        "evidence": copy.deepcopy(persona["evidence"]),
        "document_settings": {
            "template": "professional",
            "reference_template_name": None,
            "page_size": "A4",
            "page_target": 1,
            "minimum_font_pt": 10,
            "cv_only": False
        },
        "cv": {
            "sections": [
                {
                    "heading": "Professional Summary",
                    "type": "paragraphs",
                    "page_break_before": False,
                    "items": [
                        {
                            "text": "Early-career digital marketing graduate with a six-month internship supporting email campaigns, landing-page updates and weekly reporting, complemented by a marketing-analytics capstone in Google Sheets.",
                            "evidence_ids": ["EV-P03-001", "EV-P03-002", "EV-P03-003"]
                        },
                        {
                            "text": "Brings careful coordination, campaign-support discipline and a clear boundary between internship support, university project work and independent campaign ownership.",
                            "evidence_ids": ["EV-P03-001", "EV-P03-002"]
                        }
                    ]
                },
                {
                    "heading": "Role-Match Experience",
                    "type": "bullets",
                    "page_break_before": False,
                    "items": [
                        {"text": "Supported email campaigns, landing-page updates and weekly performance reporting during a six-month marketing internship.", "evidence_ids": ["EV-P03-001"]},
                        {"text": "Built a Google Sheets dashboard comparing channel spend, clicks and conversions for a university marketing-analytics capstone.", "evidence_ids": ["EV-P03-002"]},
                        {"text": "Completed a Bachelor of Commerce in Marketing in 2025.", "evidence_ids": ["EV-P03-003"]}
                    ]
                },
                {
                    "heading": "Professional Experience",
                    "type": "experience",
                    "page_break_before": False,
                    "items": [
                        {
                            "role": "Digital Marketing Intern",
                            "company": "Westbridge Community Arts",
                            "location": "Manchester",
                            "dates": "January–June 2026",
                            "evidence_ids": ["EV-P03-001"],
                            "bullets": [
                                {"text": "Supported email campaigns, landing-page updates and weekly performance reporting during a six-month placement.", "evidence_ids": ["EV-P03-001"]},
                                {"text": "Prepared campaign assets and coordinated feedback with the marketing coordinator without claiming campaign ownership.", "evidence_ids": ["EV-P03-001"]}
                            ]
                        }
                    ]
                },
                {
                    "heading": "Selected Project",
                    "type": "bullets",
                    "page_break_before": False,
                    "items": [
                        {"text": "Marketing Analytics Capstone — built a Google Sheets dashboard comparing channel spend, clicks and conversions; university project, 2025.", "evidence_ids": ["EV-P03-002"]}
                    ]
                },
                {
                    "heading": "Core Skills",
                    "type": "skills",
                    "page_break_before": False,
                    "items": [
                        {"text": "Email campaign support", "evidence_ids": ["EV-P03-001"]},
                        {"text": "Landing-page updates", "evidence_ids": ["EV-P03-001"]},
                        {"text": "Campaign reporting", "evidence_ids": ["EV-P03-001", "EV-P03-002"]},
                        {"text": "Google Sheets", "evidence_ids": ["EV-P03-002"]},
                        {"text": "Digital content coordination", "evidence_ids": ["EV-P03-001"]}
                    ]
                },
                {
                    "heading": "Education",
                    "type": "paragraphs",
                    "page_break_before": False,
                    "items": [
                        {"text": "Bachelor of Commerce (Marketing), Western Shore University, 2025", "evidence_ids": ["EV-P03-003"]}
                    ]
                }
            ]
        },
        "cover_letter": {
            "enabled": True,
            "date": "14 July 2026",
            "recipient": "Hiring Manager",
            "salutation": "Dear Hiring Manager,",
            "paragraphs": [
                {"text": "The combination of practical campaign coordination and careful use of performance data is what makes this role stand out to me. It is a natural next step from my recent digital marketing internship and marketing-analytics study.", "evidence_ids": ["EV-P03-001", "EV-P03-002"]},
                {"text": "During a six-month internship, I supported email campaigns, landing-page updates and weekly reporting while coordinating assets and feedback with the marketing coordinator. That experience taught me how reliable execution supports a wider campaign team.", "evidence_ids": ["EV-P03-001"]},
                {"text": "My university capstone added an analytical foundation: I built a Google Sheets dashboard comparing spend, clicks and conversions. I would bring that project experience as a starting point, without presenting it as commercial campaign ownership.", "evidence_ids": ["EV-P03-002"]},
                {"text": "In the first sixty days, I would learn Northlight Media's campaign calendar and CRM routines, make the weekly reporting dependable, and look for small improvements in asset hand-offs and landing-page quality checks.", "evidence_ids": ["EV-P03-001", "EV-P03-002"]},
                {"text": "I would welcome a conversation about how my internship experience, marketing qualification and practical reporting foundation could contribute to the team while I continue building depth.", "evidence_ids": ["EV-P03-001", "EV-P03-002", "EV-P03-003"]}
            ],
            "closing": "Kind regards,",
            "signature": "Aisha Khan"
        },
        "change_log": {
            "included_evidence": ["EV-P03-001", "EV-P03-002", "EV-P03-003"],
            "excluded_evidence": ["No evidence of independent campaign ownership; not claimed."],
            "keywords_included": ["email campaigns", "CRM", "landing pages", "campaign reporting", "Google Sheets"],
            "keywords_omitted": ["campaign owner", "Power BI", "marketing automation expert"],
            "ambiguities": ["UK Graduate visa expiry is not supplied and must be checked if ongoing work rights are material."],
            "archetype": "Early-career digital marketing coordinator"
        }
    }


def application_pack(*, page_target: int = 2, cv_only: bool = False) -> dict[str, Any]:
    persona = load_persona()
    evidence = copy.deepcopy(persona["evidence"])
    sections = [
        {
            "heading": "Professional Summary",
            "type": "paragraphs",
            "page_break_before": False,
            "items": [
                {
                    "text": "Enterprise transformation and operating-model leader with 14 years across healthcare, retail and utilities. Combines multi-country organisation design, transformation governance, strategic workforce planning, workforce-technology adoption and practical generative-AI workflow experimentation.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-003", "EV-P01-004", "EV-P01-009", "EV-P01-011"]
                },
                {
                    "text": "Known for turning structural choices into clear decision rights, leadership routines, adoption measures and implementation roadmaps that operating leaders can use.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-007", "EV-P01-008"]
                },
                {
                    "text": "Delivery experience spans executive design workshops, design assurance, change-champion networks, workforce scenario reviews, spans-and-layers analysis, leadership capability and role architecture—while keeping pilot, completion and source-only metrics within their evidenced scope.",
                    "evidence_ids": ["EV-P01-006", "EV-P01-007", "EV-P01-008", "EV-P01-010", "EV-P01-011", "EV-P01-012", "EV-P01-013", "EV-P01-014"]
                }
            ]
        },
        {
            "heading": "Role-Match Experience",
            "type": "bullets",
            "page_break_before": False,
            "items": [
                {
                    "text": "Led a multi-country operating-model redesign covering an 8,000-person regional workforce across Australia and Asia.",
                    "evidence_ids": ["EV-P01-001"]
                },
                {
                    "text": "Established program governance, executive decision forums and adoption measures for a workforce-platform rollout.",
                    "evidence_ids": ["EV-P01-002"]
                },
                {
                    "text": "Built a generative-AI manager-guidance prototype using structured prompts, review gates and feedback capture.",
                    "evidence_ids": ["EV-P01-003"]
                },
                {
                    "text": "Brings senior transformation leadership experience from healthcare and retail organisations.",
                    "evidence_ids": ["EV-P01-004"]
                },
                {
                    "text": "Introduced a strategic workforce-planning cycle across six business units and facilitated 25 executive design workshops to resolve accountabilities and implementation choices.",
                    "evidence_ids": ["EV-P01-007", "EV-P01-009"]
                },
                {
                    "text": "Redesigned spans and layers across a 150-site network, identifying 12% overlapping management positions for staged removal through vacancies and natural attrition.",
                    "evidence_ids": ["EV-P01-008"]
                },
                {
                    "text": "Reduced a role-approval cycle from 20 to 9 business days by clarifying decision rights and standardising role documentation.",
                    "evidence_ids": ["EV-P01-016"]
                }
            ]
        },
        {
            "heading": "AI and Workforce Technology",
            "type": "bullets",
            "page_break_before": False,
            "items": [
                {
                    "text": "Built a practical GenAI manager-guidance prototype using structured prompts, human-review gates and feedback capture; positions the work as adoption and workflow design rather than engineering ownership.",
                    "evidence_ids": ["EV-P01-003"]
                },
                {
                    "text": "Established governance, adoption measures and executive decision forums for a workforce-platform rollout, with 82% manager completion in the pilot adoption pathway.",
                    "evidence_ids": ["EV-P01-002", "EV-P01-006"]
                },
                {
                    "text": "Connects emerging-technology choices to role clarity, operating-model interfaces and the routines leaders need to make adoption sustainable.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-003", "EV-P01-011"]
                },
                {
                    "text": "Built a network of 90 change champions across 12 functions to test guidance, surface adoption risks and create feedback loops between the program and operating teams.",
                    "evidence_ids": ["EV-P01-013"]
                },
                {
                    "text": "Established a design-assurance forum that reviewed 40 operating-model proposals and retained a transparent decision log, strengthening consistency without creating a statutory governance claim.",
                    "evidence_ids": ["EV-P01-012"]
                }
            ]
        },
        {
            "heading": "Selected Professional Experience",
            "type": "experience",
            "page_break_before": page_target == 2,
            "items": [
                {
                    "role": "Transformation Director",
                    "company": "Northstar Health",
                    "location": "Melbourne",
                    "dates": "2021–Present",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-003", "EV-P01-004", "EV-P01-006", "EV-P01-007", "EV-P01-009", "EV-P01-012", "EV-P01-013", "EV-P01-014"],
                    "bullets": [
                        {
                            "text": "Led the operating-model redesign for an 8,000-person regional workforce, aligning decision rights and governance across Australia and Asia.",
                            "evidence_ids": ["EV-P01-001"]
                        },
                        {
                            "text": "Established governance, executive decision forums and adoption measures for a workforce-platform rollout.",
                            "evidence_ids": ["EV-P01-002"]
                        },
                        {
                            "text": "Achieved 82% manager completion in the pilot adoption pathway, keeping the metric tied to the pilot rather than implying enterprise-wide adoption.",
                            "evidence_ids": ["EV-P01-006"]
                        },
                        {
                            "text": "Introduced a strategic workforce-planning cycle across six business units to connect workforce choices with operating-model priorities.",
                            "evidence_ids": ["EV-P01-009"]
                        },
                        {
                            "text": "Facilitated 25 executive design workshops to resolve accountabilities, cross-functional interfaces and implementation choices.",
                            "evidence_ids": ["EV-P01-007"]
                        },
                        {
                            "text": "Built a practical generative-AI workflow prototype for manager guidance, with human review and feedback capture.",
                            "evidence_ids": ["EV-P01-003"]
                        },
                        {
                            "text": "Established a design-assurance forum that reviewed 40 operating-model proposals and maintained a transparent decision log across the transformation portfolio.",
                            "evidence_ids": ["EV-P01-012"]
                        },
                        {
                            "text": "Built a 90-person change-champion network across 12 functions to test guidance and surface adoption risks without implying direct line management of the network.",
                            "evidence_ids": ["EV-P01-013"]
                        },
                        {
                            "text": "Consolidated workforce scenarios into a quarterly executive review that identified 240 critical capability gaps for prioritisation.",
                            "evidence_ids": ["EV-P01-014"]
                        }
                    ]
                },
                {
                    "role": "Senior Manager, Organisation Transformation",
                    "company": "Harbour Retail",
                    "location": "Melbourne",
                    "dates": "2016–2021",
                    "evidence_ids": ["EV-P01-004", "EV-P01-008", "EV-P01-010", "EV-P01-015"],
                    "bullets": [
                        {
                            "text": "Held senior organisation-transformation accountability in a large retail environment before moving into healthcare transformation leadership.",
                            "evidence_ids": ["EV-P01-004"]
                        },
                        {
                            "text": "Redesigned spans and layers across a 150-site service network, identifying 12% overlapping management positions for staged removal through vacancies and natural attrition.",
                            "evidence_ids": ["EV-P01-008"]
                        },
                        {
                            "text": "Designed a transformation-leadership program completed by 600 people leaders, without overstating completion as proof of behaviour change.",
                            "evidence_ids": ["EV-P01-010"]
                        },
                        {
                            "text": "Facilitated executive operating-model decisions and translated them into practical transformation roadmaps for retail operations and corporate functions.",
                            "evidence_ids": ["EV-P01-004", "EV-P01-007"]
                        },
                        {
                            "text": "Facilitated 30 process and interface-mapping sessions across the service network to clarify hand-offs between stores, regional teams and corporate functions.",
                            "evidence_ids": ["EV-P01-015"]
                        }
                    ]
                },
                {
                    "role": "Organisation Design Manager",
                    "company": "Civic Utilities",
                    "location": "Melbourne",
                    "dates": "2012–2016",
                    "evidence_ids": ["EV-P01-004", "EV-P01-011", "EV-P01-016"],
                    "bullets": [
                        {
                            "text": "Supported organisation design, role clarity and workforce-planning initiatives across a regulated utilities environment.",
                            "evidence_ids": ["EV-P01-004", "EV-P01-011"]
                        },
                        {
                            "text": "Created a role architecture covering 120 recurring job profiles to improve role clarity and workforce reporting, without claiming a formal job-evaluation methodology.",
                            "evidence_ids": ["EV-P01-011"]
                        },
                        {
                            "text": "Reduced the role-approval cycle from 20 to 9 business days by clarifying decision rights and standardising role documentation.",
                            "evidence_ids": ["EV-P01-016"]
                        }
                    ]
                }
            ]
        },
        {
            "heading": "Core Skills",
            "type": "skills",
            "page_break_before": False,
            "items": [
                {"text": "Operating model design", "evidence_ids": ["EV-P01-001"]},
                {"text": "Transformation governance", "evidence_ids": ["EV-P01-002"]},
                {"text": "Workforce technology adoption", "evidence_ids": ["EV-P01-002"]},
                {"text": "Practical GenAI workflows", "evidence_ids": ["EV-P01-003"]},
                {"text": "Executive stakeholder alignment", "evidence_ids": ["EV-P01-001", "EV-P01-002"]},
                {"text": "Strategic workforce planning", "evidence_ids": ["EV-P01-009"]},
                {"text": "Spans and layers", "evidence_ids": ["EV-P01-008"]},
                {"text": "Role architecture", "evidence_ids": ["EV-P01-011"]},
                {"text": "Leadership capability", "evidence_ids": ["EV-P01-010"]},
                {"text": "Design assurance", "evidence_ids": ["EV-P01-012"]},
                {"text": "Change champion networks", "evidence_ids": ["EV-P01-013"]},
                {"text": "Workforce scenario review", "evidence_ids": ["EV-P01-014"]},
                {"text": "Process and interface mapping", "evidence_ids": ["EV-P01-015"]}
            ]
        },
        {
            "heading": "Education",
            "type": "paragraphs",
            "page_break_before": False,
            "items": [
                {
                    "text": "MBA, Southern Coast University",
                    "evidence_ids": ["EV-P01-005"]
                }
            ]
        },
        {
            "heading": "Recognition and Certification",
            "type": "paragraphs",
            "page_break_before": False,
            "items": [
                {
                    "text": "Prosci Change Practitioner",
                    "evidence_ids": ["EV-P01-005"]
                }
            ]
        }
    ]
    return {
        "schema_version": "4.0",
        "candidate": {
            "name": persona["profile"]["name"],
            "headline": persona["profile"]["headline"],
            "contact": [
                {"text": "Melbourne, Australia", "url": None},
                {"text": "Email", "url": "mailto:maya.patel@example.test"},
                {"text": "LinkedIn", "url": "https://www.linkedin.com/in/maya-patel-synthetic"}
            ]
        },
        "role": role_dossier(),
        "evidence": evidence,
        "document_settings": {
            "template": "executive",
            "reference_template_name": None,
            "page_size": "A4",
            "page_target": page_target,
            "minimum_font_pt": 9.7,
            "cv_only": cv_only
        },
        "cv": {"sections": sections},
        "cover_letter": {
            "enabled": not cv_only,
            "date": "14 July 2026",
            "recipient": "Hiring Director",
            "salutation": "Dear Hiring Director,",
            "paragraphs": [
                {
                    "text": "What stands out about this transformation mandate is the need to connect operating-model choices with the governance and adoption that make them real. That combination has shaped my work across senior healthcare and retail transformation roles.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-004"]
                },
                {
                    "text": "At Northstar Health, I led an operating-model redesign spanning an 8,000-person regional workforce across Australia and Asia. The work required clear decision rights, practical governance and alignment across stakeholders rather than a conceptual design that stopped at the organisation chart.",
                    "evidence_ids": ["EV-P01-001"]
                },
                {
                    "text": "I also established executive decision forums, adoption measures and governance routines for a workforce-platform rollout. Alongside this enterprise work, I built a generative-AI manager-guidance prototype using structured prompts, human review gates and feedback capture, giving me a practical view of where emerging technology genuinely helps workforce decisions.",
                    "evidence_ids": ["EV-P01-002", "EV-P01-003"]
                },
                {
                    "text": "In the first ninety days, I would focus on clarifying the transformation outcomes, decision rights and adoption risks; building a transparent roadmap; and creating a small number of measurable governance routines that leaders and delivery teams can use. I would bring the same bias toward practical implementation that has underpinned my operating-model and workforce-technology work.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002"]
                },
                {
                    "text": "I would welcome a conversation about how this combination of operating-model depth, adoption discipline and practical AI workflow experience could support Atlas Services' transformation agenda.",
                    "evidence_ids": ["EV-P01-001", "EV-P01-002", "EV-P01-003"]
                }
            ],
            "closing": "Kind regards,",
            "signature": "Maya Patel"
        },
        "change_log": {
            "included_evidence": ["EV-P01-001", "EV-P01-002", "EV-P01-003", "EV-P01-004", "EV-P01-005", "EV-P01-006", "EV-P01-007", "EV-P01-008", "EV-P01-009", "EV-P01-010", "EV-P01-011", "EV-P01-012", "EV-P01-013", "EV-P01-014", "EV-P01-015", "EV-P01-016"],
            "excluded_evidence": ["No evidence for P&L ownership; not claimed."],
            "keywords_included": ["operating model", "transformation governance", "workforce technology", "adoption", "generative AI", "strategic workforce planning", "spans and layers", "role architecture", "leadership capability", "design assurance", "change champion network", "workforce scenarios", "process interfaces"],
            "keywords_omitted": ["P&L ownership", "AI engineering", "global transformation"],
            "ambiguities": ["Synthetic fixture; CV metrics are source-only."],
            "archetype": "Senior enterprise transformation leader"
        }
    }


def career_passport() -> dict[str, Any]:
    persona = load_persona()
    return {
        "schema_version": "4.0",
        "profile": copy.deepcopy(persona["profile"]),
        "preferences": copy.deepcopy(persona["preferences"]),
        "source_documents": [
            {
                "source_id": "SRC-P01-PRIMARY",
                "name": "Synthetic senior transformation CV",
                "source_type": "current_cv",
                "target_directions": ["Enterprise transformation", "Operating model leadership"],
                "is_primary": True,
                "version_date": "2026-07-14",
                "content_fingerprint": "sha256:synthetic-cv-p01",
                "notes": ["Synthetic evaluation fixture."],
                "ingested_at": "2026-07-14T09:30:00+08:00"
            }
        ],
        "document_versions": [
            {
                "version_id": "DOC-P01-BASE-001",
                "document_type": "cv_base",
                "role_id": None,
                "file_name": "Synthetic_Senior_Transformation_CV_Base.docx",
                "source_document_ids": ["SRC-P01-PRIMARY"],
                "created_at": "2026-07-14T09:30:00+08:00",
                "status": "ready",
                "change_summary": ["Registered the synthetic reusable CV base for version-history testing."]
            }
        ],
        "evidence": copy.deepcopy(persona["evidence"]),
        "role_history": [],
        "application_events": [],
        "corrections": [],
        "feedback": [],
        "updated_at": "2026-07-14T09:30:00+08:00"
    }


def run_result(*, status: str = "SUCCESS", requested: list[str] | None = None) -> dict[str, Any]:
    requested = ["ROLE-SYNTH-001"] if requested is None else requested
    return {
        "schema_version": "4.0",
        "run_id": "RUN-SYNTH-001",
        "status": status,
        "started_at": "2026-07-14T09:00:00+08:00",
        "completed_at": "2026-07-14T09:45:00+08:00",
        "request": {"search_requested": True, "application_packs_requested": requested},
        "limits": {"max_displayed_roles": 5, "max_apply_roles": 3, "max_application_packs": 3},
        "roles": [role_dossier()],
        "files": ["Application_Packs/ROLE-SYNTH-001/application_pack_manifest.json"] if status == "SUCCESS" else [],
        "validation_reports": ["Run_Validation.json"] if status == "SUCCESS" else [],
        "summary": "Synthetic test run."
    }
