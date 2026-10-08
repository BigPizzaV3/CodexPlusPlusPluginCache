#!/usr/bin/env python3
"""
ChatGPT & Codex Deterministic Skill Router Engine.

Analyzes user queries, classifies engineering intent, and returns the narrowest,
highest-leverage specialist skill from the 42 curated skills in matt-skills-curated.
"""

from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / "skills"

# Deterministic Intent Matching Rules
ROUTING_RULES: Dict[str, Dict[str, Any]] = {
    # Discovery & Planning
    "grill-with-docs": {
        "patterns": [
            r"\b(grill with docs|interview.*adr|interview.*context\.md|capture.*domain docs)\b",
            r"\b(interview.*architecture decisions?|grill.*document)\b"
        ],
        "keywords": ["grill with docs", "adr interview", "document domain"],
        "category": "Discovery & Planning",
        "description": "Focused interview while capturing domain terms & ADRs concurrently."
    },
    "grill-me": {
        "patterns": [
            r"\b(grill me|stress test my thinking|expose assumptions|poke holes in my plan)\b",
            r"\b(interview me before coding|ask me hard questions)\b"
        ],
        "keywords": ["grill me", "poke holes", "stress test", "expose assumptions"],
        "category": "Discovery & Planning",
        "description": "Socratic interview to expose ambiguity and weak assumptions."
    },
    "grilling": {
        "patterns": [
            r"\b(grill|grilling|decision frontier|interview rounds?)\b"
        ],
        "keywords": ["grill", "grilling", "decision questions"],
        "category": "Discovery & Planning",
        "description": "Relentless multi-round questioning to sharpen fuzzy thinking."
    },
    "to-spec": {
        "patterns": [
            r"\b(to spec|write a spec|create spec|generate specification|technical spec)\b",
            r"\b(turn.*into a spec|formalize requirements)\b"
        ],
        "keywords": ["spec", "specification", "technical spec", "to-spec"],
        "category": "Discovery & Planning",
        "description": "Synthesize a buildable specification from conversational context."
    },
    "to-tickets": {
        "patterns": [
            r"\b(to tickets|break into tickets|create tickets|task graph|tracer bullets)\b",
            r"\b(split into issues|decomposition.*tickets)\b"
        ],
        "keywords": ["tickets", "tracer bullets", "task graph", "break down"],
        "category": "Discovery & Planning",
        "description": "Decompose spec into ordered tracer-bullet DAG tickets."
    },
    "to-questionnaire": {
        "patterns": [
            r"\b(to questionnaire|questionnaire for stakeholders?|async questions?)\b",
            r"\b(client questionnaire|requirements survey)\b"
        ],
        "keywords": ["questionnaire", "stakeholder questions", "async inquiry"],
        "category": "Discovery & Planning",
        "description": "Turn unknown requirements into a structured stakeholder questionnaire."
    },
    "prototype": {
        "patterns": [
            r"\b(prototype|throwaway code|spike|explore ui look|quick mockup)\b",
            r"\b(scratch branch|sanity check state model)\b"
        ],
        "keywords": ["prototype", "mockup", "throwaway", "ui spike"],
        "category": "Discovery & Planning",
        "description": "Build throwaway code or UI mockup to answer design uncertainties."
    },
    "workflow-designer": {
        "patterns": [
            r"\b(workflow designer|design.*workflow|operational routine|recurring process)\b",
            r"\b(sop|standard operating procedure|process specification)\b"
        ],
        "keywords": ["workflow", "operational routine", "recurring process", "sop"],
        "category": "Discovery & Planning",
        "description": "Design reliable recurring operational workflows with human checkpoints."
    },
    "research": {
        "patterns": [
            r"\b(research|investigate api|read documentation|gather docs|background research)\b",
            r"\b(primary source research|read third party docs)\b"
        ],
        "keywords": ["research", "investigate api", "read docs", "primary sources"],
        "category": "Discovery & Planning",
        "description": "Investigate external documentation and capture cited research notes."
    },

    # Architecture & Design
    "domain-modeling": {
        "patterns": [
            r"\b(domain model|ubiquitous language|context\.md|domain terms?|adr)\b",
            r"\b(architectural decision record|define entities|glossary)\b"
        ],
        "keywords": ["domain modeling", "ubiquitous language", "context.md", "adr"],
        "category": "Architecture & Design",
        "description": "Define ubiquitous language, domain entities, and ADRs."
    },
    "codebase-design": {
        "patterns": [
            r"\b(codebase design|deep modules?|ousterhout|module interface|design seams?)\b",
            r"\b(interface design|module boundary)\b"
        ],
        "keywords": ["deep modules", "codebase design", "interface design", "module seams"],
        "category": "Architecture & Design",
        "description": "Design deep modules with small interfaces hiding deep complexity."
    },
    "improve-codebase-architecture": {
        "patterns": [
            r"\b(improve architecture|codebase architecture|churn analysis|shallow modules)\b",
            r"\b(architectural audit|visual architecture report)\b"
        ],
        "keywords": ["improve architecture", "architectural review", "churn hotspot"],
        "category": "Architecture & Design",
        "description": "Audit codebase for shallow modules and git churn hotspots."
    },
    "setup-ts-deep-modules": {
        "patterns": [
            r"\b(setup ts deep modules|dependency-cruiser|ts boundaries|package entry points?)\b",
            r"\b(barrel files?|circular dependencies?|enforce ts modules)\b"
        ],
        "keywords": ["dependency-cruiser", "ts deep modules", "boundary rules"],
        "category": "Architecture & Design",
        "description": "Enforce strict TypeScript package boundaries with dependency-cruiser."
    },
    "migrate-to-shoehorn": {
        "patterns": [
            r"\b(shoehorn|frompartial|fromany|fromexact|migrate.*type assertions?)\b",
            r"\b(unsafe typecast in tests?|fix test fixtures? types?)\b"
        ],
        "keywords": ["shoehorn", "frompartial", "fromany", "test typecast"],
        "category": "Architecture & Design",
        "description": "Migrate unsafe test type assertions to @total-typescript/shoehorn."
    },

    # Execution, Code & Safety
    "implement": {
        "patterns": [
            r"\b(implement|build this feature|code the spec|write code for.*ticket)\b",
            r"\b(execute plan|start coding)\b"
        ],
        "keywords": ["implement", "build feature", "code spec", "write code"],
        "category": "Execution & Quality",
        "description": "Implement approved specs via vertical tracer slices and TDD."
    },
    "implement-spec": {
        "patterns": [
            r"\b(implement spec|parallel subagents?|subagent worktrees?|multi-agent pr)\b",
            r"\b(build whole spec with agents)\b"
        ],
        "keywords": ["implement-spec", "subagent worktree", "parallel implementers"],
        "category": "Execution & Quality",
        "description": "Orchestrate parallel subagents implementing a task graph into a single PR."
    },
    "tdd": {
        "patterns": [
            r"\b(tdd|test driven|test first|red green refactor|unit test for)\b",
            r"\b(write failing test first)\b"
        ],
        "keywords": ["tdd", "test driven", "red-green", "test-first"],
        "category": "Execution & Quality",
        "description": "Implement behavior test-first through red-green-refactor cycles."
    },
    "diagnosing-bugs": {
        "patterns": [
            r"\b(diagnose|debug|fix bug|broken behavior|exception|failing test|flaky)\b",
            r"\b(investigate failure|regression|slow query|crash)\b"
        ],
        "keywords": ["diagnose", "debug", "bug", "broken", "failing", "crash", "flake"],
        "category": "Execution & Quality",
        "description": "Diagnose hard bugs and performance regressions using a tight red loop."
    },
    "code-review": {
        "patterns": [
            r"\b(code review|review branch|review pr|review diff|audit diff)\b",
            r"\b(two axis review|check against coding standards)\b"
        ],
        "keywords": ["code review", "review pr", "review branch", "diff audit"],
        "category": "Execution & Quality",
        "description": "Two-axis code review against Standards and Spec compliance."
    },
    "resolving-merge-conflicts": {
        "patterns": [
            r"\b(merge conflict|rebase conflict|resolve conflict|git conflict markers?)\b",
            r"\b(fix merge|rebase failed)\b"
        ],
        "keywords": ["merge conflict", "rebase conflict", "conflict markers"],
        "category": "Execution & Quality",
        "description": "Resolve Git merge/rebase conflicts by intent traced to primary sources."
    },
    "git-safety-guardrails": {
        "patterns": [
            r"\b(git safety|git guardrails|block dangerous git|force push protection)\b",
            r"\b(prevent hard reset|intercept destructive git)\b"
        ],
        "keywords": ["git guardrails", "git safety", "block git push", "hard reset guard"],
        "category": "Execution & Quality",
        "description": "Intercept and block destructive or history-rewriting Git operations."
    },
    "setup-engineering-workflows": {
        "patterns": [
            r"\b(setup engineering workflows|setup workflows|configure issue tracker)\b",
            r"\b(setup triage labels|setup context\.md)\b"
        ],
        "keywords": ["setup engineering workflows", "configure tracker", "triage labels"],
        "category": "Execution & Quality",
        "description": "Configure repository issue tracker, triage labels, and domain doc rules."
    },
    "setup-pre-commit": {
        "patterns": [
            r"\b(setup pre commit|husky|lint-staged|pre-commit hooks?|prettier hook)\b",
            r"\b(install husky|staged linter)\b"
        ],
        "keywords": ["setup pre-commit", "husky", "lint-staged", "git hooks"],
        "category": "Execution & Quality",
        "description": "Configure Husky and lint-staged pre-commit checks with Prettier."
    },
    "triage": {
        "patterns": [
            r"\b(triage|triage issues?|process bug reports?|agent brief|out of scope kb)\b",
            r"\b(classify incoming issues?|reproduce bug report)\b"
        ],
        "keywords": ["triage", "triage issues", "agent brief", "out-of-scope"],
        "category": "Execution & Quality",
        "description": "Classify external issues, reproduce bugs, and author agent briefs."
    },
    "wayfinder": {
        "patterns": [
            r"\b(wayfinder|map out project|fog of war|decision tickets?|multi session effort)\b",
            r"\b(huge greenfield|massive migration map)\b"
        ],
        "keywords": ["wayfinder", "fog of war", "decision map", "multi-session"],
        "category": "Execution & Quality",
        "description": "Map and navigate large, uncertain multi-session efforts with decision tickets."
    },
    "wizard": {
        "patterns": [
            r"\b(wizard|bash wizard|interactive setup script|provision credentials)\b",
            r"\b(manual dashboard steps?|ci secrets wizard)\b"
        ],
        "keywords": ["wizard", "bash wizard", "dashboard setup", "credentials script"],
        "category": "Execution & Quality",
        "description": "Generate an interactive Bash wizard for human-only dashboard steps."
    },

    # AI, ML & Cognitive Super-Skills
    "ai-engineering": {
        "patterns": [
            r"\b(ai engineering|train model|fine tune|lora|qlora|peft|vllm|onnx)\b",
            r"\b(sub-100ms inference|model serving|disparate impact|fairness audit)\b"
        ],
        "keywords": ["ai engineering", "fine-tuning", "lora", "model serving", "latency budget"],
        "category": "AI, ML & Cognitive",
        "description": "Production ML & LLM engineering with sub-100ms latency and fairness audits."
    },
    "ai-data-remediation": {
        "patterns": [
            r"\b(data remediation|self healing data|ast validation|anomaly clustering)\b",
            r"\b(zero loss reconciliation|fix corrupt data pipeline|etl error healing)\b"
        ],
        "keywords": ["data remediation", "self-healing", "ast validation", "zero loss"],
        "category": "AI, ML & Cognitive",
        "description": "Self-healing data pipeline layer using AST-validated lambda fixes."
    },
    "ml-best-practices": {
        "patterns": [
            r"\b(ml best practices|bootstrap confidence intervals?|leakage free|eda)\b",
            r"\b(dual model baseline|missing value strategy|statistical ml)\b"
        ],
        "keywords": ["ml best practices", "bootstrap ci", "eda", "data leakage"],
        "category": "AI, ML & Cognitive",
        "description": "Statistical ML standards: leakage-free splits and 95% bootstrap CIs."
    },
    "j-space": {
        "patterns": [
            r"\b(j space|j-space|inner cognitive|inner reasoning|three registers)\b",
            r"\b(long horizon planning|seam audit|deep thinking mode)\b"
        ],
        "keywords": ["j-space", "cognitive workspace", "three registers", "seam audit"],
        "category": "AI, ML & Cognitive",
        "description": "Inner cognitive workspace for multi-step reasoning and register separation."
    },
    "goal": {
        "patterns": [
            r"\b(goal prompt|autonomous goal|overnight run|unattended execution)\b",
            r"\b(goal contract|autonomous mission)\b"
        ],
        "keywords": ["goal", "goal prompt", "autonomous mission", "unattended run"],
        "category": "AI, ML & Cognitive",
        "description": "Synthesize high-leverage /goal prompts for unattended autonomous runs."
    },
    "skill-conductor": {
        "patterns": [
            r"\b(skill conductor|author skill|create skill|improve skill|skill evals?)\b",
            r"\b(bineval|10 canonical principles|package skills?)\b"
        ],
        "keywords": ["skill-conductor", "author skill", "improve skill", "skill evals"],
        "category": "AI, ML & Cognitive",
        "description": "Full lifecycle management for agent skills: draft, test, review, package."
    },

    # Continuity, Teaching & Communication
    "handoff": {
        "patterns": [
            r"\b(handoff|save session|session continuation|transfer context|pause work)\b",
            r"\b(switch agents?|compact session to file)\b"
        ],
        "keywords": ["handoff", "session continuation", "transfer work", "pause session"],
        "category": "Continuity & Teaching",
        "description": "Compact conversation context and decisions into a portable handoff file."
    },
    "retro": {
        "patterns": [
            r"\b(retro|retrospective|audit agent mistakes?|improve agent environment)\b",
            r"\b(review session mistakes|rule hierarchy)\b"
        ],
        "keywords": ["retro", "retrospective", "audit mistakes", "agent environment"],
        "category": "Continuity & Teaching",
        "description": "Conduct session retrospective to optimize navigation pointers and rules."
    },
    "wait-what": {
        "patterns": [
            r"\b(wait what|i don't get it|re-pitch|simplify explanation|too complex)\b",
            r"\b(explain simpler|ste100|plain english)\b"
        ],
        "keywords": ["wait-what", "re-pitch", "simplify explanation", "plain english"],
        "category": "Continuity & Teaching",
        "description": "Re-pitch an explanation from a simpler angle using plain English."
    },
    "teach": {
        "patterns": [
            r"\b(teach me|explain concept|learning lab|lesson|how does this work)\b",
            r"\b(learning records?|study this codebase)\b"
        ],
        "keywords": ["teach", "lesson", "learning lab", "explain concept"],
        "category": "Continuity & Teaching",
        "description": "Teach technical concepts interactively via HTML labs and learning records."
    },
    "writing-for-agents": {
        "patterns": [
            r"\b(writing for agents|agent instructions?|prompt guidelines?|steerable docs)\b",
            r"\b(author agents\.md|author claude\.md|context pointers?)\b"
        ],
        "keywords": ["writing-for-agents", "agent instructions", "steerable docs"],
        "category": "Continuity & Teaching",
        "description": "Author steerable agent documents, AGENTS.md rules, and context pointers."
    },

    # Writing & Educational Scaffolding
    "writing-fragments": {
        "patterns": [
            r"\b(writing fragments|brainstorm notes|capture ideas|raw fragments)\b",
            r"\b(explore article ideas|leading word capture)\b"
        ],
        "keywords": ["writing-fragments", "brainstorm notes", "raw fragments"],
        "category": "Writing & Scaffolding",
        "description": "Capture unstructured writing fragments and metaphors with zero friction."
    },
    "writing-shape": {
        "patterns": [
            r"\b(writing shape|shape draft|turn notes into draft|block by block)\b",
            r"\b(assemble article|concept grounding)\b"
        ],
        "keywords": ["writing-shape", "shape draft", "turn notes into article"],
        "category": "Writing & Scaffolding",
        "description": "Shape raw note fragments into a structured article draft block-by-block."
    },
    "writing-beats": {
        "patterns": [
            r"\b(writing beats|narrative beats|beat by beat|choose your own adventure)\b",
            r"\b(interactive drafting|branching article)\b"
        ],
        "keywords": ["writing-beats", "narrative beats", "beat by beat drafting"],
        "category": "Writing & Scaffolding",
        "description": "Develop long-form writing through an interactive beat-by-beat journey."
    },
    "scaffold-exercises": {
        "patterns": [
            r"\b(scaffold exercises|create exercise|course exercises|workshop tutorial)\b",
            r"\b(problem explainer solution folders?|ai hero cli internal lint)\b"
        ],
        "keywords": ["scaffold-exercises", "exercise boilerplate", "workshop exercises"],
        "category": "Writing & Scaffolding",
        "description": "Scaffold numbered educational exercise folders and problem/solution variants."
    }
}


def classify_intent(query: str) -> Dict[str, Any]:
    cleaned = query.strip().lower()
    scores: List[Tuple[str, float, str]] = []

    for skill, rule in ROUTING_RULES.items():
        score = 0.0
        match_reason = "general match"

        for pat in rule.get("patterns", []):
            if re.search(pat, cleaned):
                score += 10.0
                match_reason = f"regex match on '{pat}'"
                break

        for kw in rule.get("keywords", []):
            if kw in cleaned:
                score += 4.0
                match_reason = f"keyword match on '{kw}'"

        if score > 0:
            scores.append((skill, score, match_reason))

    if not scores:
        return {
            "primary_skill": "engineering-workflow-guide",
            "category": "Workflow Routing",
            "confidence": 0.5,
            "reason": "Default router fallback for general or multi-phase query",
            "pipeline": ["engineering-workflow-guide"],
            "skill_path": str(SKILLS_DIR / "engineering-workflow-guide" / "SKILL.md")
        }

    scores.sort(key=lambda x: x[1], reverse=True)
    best_skill, best_score, best_reason = scores[0]
    rule_meta = ROUTING_RULES.get(best_skill, {})

    pipeline = [best_skill]
    if best_skill in {"grill-me", "grill-with-docs", "grilling"}:
        pipeline = [best_skill, "to-spec", "to-tickets", "implement", "code-review"]
    elif best_skill == "to-spec":
        pipeline = ["to-spec", "to-tickets", "implement", "code-review"]
    elif best_skill == "to-tickets":
        pipeline = ["to-tickets", "implement", "code-review"]
    elif best_skill == "implement":
        pipeline = ["implement", "code-review"]
    elif best_skill == "diagnosing-bugs":
        pipeline = ["diagnosing-bugs", "tdd", "code-review"]
    elif best_skill == "ai-engineering":
        pipeline = ["ai-engineering", "ml-best-practices", "code-review"]
    elif best_skill == "writing-fragments":
        pipeline = ["writing-fragments", "writing-shape"]

    return {
        "primary_skill": best_skill,
        "category": rule_meta.get("category", "General"),
        "confidence": min(1.0, best_score / 10.0),
        "reason": best_reason,
        "description": rule_meta.get("description", ""),
        "pipeline": pipeline,
        "skill_path": str(SKILLS_DIR / best_skill / "SKILL.md")
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/route_skill.py \"<user request prompt>\" [--json]")
        sys.exit(1)

    json_mode = "--json" in sys.argv
    query_args = [a for a in sys.argv[1:] if a != "--json"]
    query = " ".join(query_args)

    result = classify_intent(query)

    if json_mode:
        print(json.dumps(result, indent=2))
    else:
        print("=" * 60)
        print("🎯 CHATGPT SKILL ROUTER VERDICT")
        print("=" * 60)
        print(f"Query:         {query}")
        print(f"Primary Skill: {result['primary_skill']}")
        print(f"Category:      {result['category']}")
        print(f"Confidence:    {result['confidence'] * 100:.1f}%")
        print(f"Reason:        {result['reason']}")
        print(f"Skill Path:    {result['skill_path']}")
        print(f"Lifecycle Plan: {' -> '.join(result['pipeline'])}")
        print("=" * 60)


if __name__ == "__main__":
    main()
