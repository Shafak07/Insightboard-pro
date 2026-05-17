"""OpenAI-powered dataset insights, chart narration, and natural language Q&A."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from services.openai_service import get_llm_model, get_openai_client

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = (
    "You are a senior data analyst. "
    "Analyze this dataset profile and provide "
    "clear, actionable business insights. "
    "Be specific with numbers. No generic advice."
)

SUMMARY_USER_TEMPLATE = """Dataset EDA Profile: {eda_profile}

Return a JSON with exactly these keys:
- executive_summary: 2-3 sentence overview
- key_findings: list of 5 specific findings with exact numbers from the data
- data_quality_issues: list of specific problems found (nulls, outliers, etc.)
- recommended_charts: list of 3 objects each with
  {{chart_type, x_column, y_column, reason}}
- business_questions: list of 5 questions this data can answer
- anomalies: list of unusual patterns spotted"""

CHART_INSIGHT_SYSTEM = (
    "You are a data visualization expert. "
    "Write concise, specific insights about the chart data shown. "
    "Reference numbers from the sample. No bullet points."
)

ASK_SYSTEM = (
    "You are a data analyst answering questions about a CSV dataset. "
    "Use only the sample rows and column metadata provided. "
    "If uncertain, say so and lower confidence. "
    "Return valid JSON only."
)


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    return {}


def _default_summary(eda_profile: dict[str, Any], error: str | None = None) -> dict[str, Any]:
    quality = eda_profile.get("quality") if isinstance(eda_profile.get("quality"), dict) else {}
    score = quality.get("score", 0)
    summary = eda_profile.get("summary") if isinstance(eda_profile.get("summary"), dict) else {}
    rows = summary.get("rows", "?")
    cols = summary.get("columns", "?")
    issues = list(quality.get("warnings") or [])
    if error:
        issues.append(f"AI unavailable: {error}")

    return {
        "executive_summary": (
            f"This dataset contains {rows} rows and {cols} columns "
            f"with a data quality score of {score}/100."
            + (f" {error}" if error else "")
        ),
        "key_findings": issues[:5] if issues else ["Review column profiles in the datasets view."],
        "data_quality_issues": issues,
        "recommended_charts": [],
        "business_questions": [
            "What are the top values in the primary metric column?",
            "How do null rates vary across columns?",
            "Are there seasonal or time-based patterns?",
            "Which categories drive the largest share of volume?",
            "What outliers might skew aggregate metrics?",
        ],
        "anomalies": [],
        "quality_score": score,
    }


def _normalize_summary(raw: dict[str, Any], eda_profile: dict[str, Any]) -> dict[str, Any]:
    quality = eda_profile.get("quality") if isinstance(eda_profile.get("quality"), dict) else {}
    charts_raw = raw.get("recommended_charts") or []
    recommended: list[dict[str, str]] = []
    if isinstance(charts_raw, list):
        for item in charts_raw[:3]:
            if not isinstance(item, dict):
                continue
            recommended.append(
                {
                    "chart_type": str(item.get("chart_type") or item.get("chartType") or "bar"),
                    "x_column": str(item.get("x_column") or item.get("xColumn") or ""),
                    "y_column": str(item.get("y_column") or item.get("yColumn") or ""),
                    "reason": str(item.get("reason") or ""),
                }
            )

    def _str_list(key: str, limit: int = 5) -> list[str]:
        val = raw.get(key) or []
        if not isinstance(val, list):
            return []
        return [str(x) for x in val[:limit] if x]

    return {
        "executive_summary": str(raw.get("executive_summary") or ""),
        "key_findings": _str_list("key_findings", 5),
        "data_quality_issues": _str_list("data_quality_issues", 10),
        "recommended_charts": recommended,
        "business_questions": _str_list("business_questions", 5),
        "anomalies": _str_list("anomalies", 10),
        "quality_score": float(quality.get("score", raw.get("quality_score", 0)) or 0),
    }


class AIInsightService:
    AI_SUMMARY_CACHE_TTL = 86400  # 24 hours

    @staticmethod
    def summary_cache_key(dataset_id: str) -> str:
        return f"dataset:{dataset_id}:ai_summary"

    @classmethod
    async def generate_dataset_summary(
        cls,
        eda_profile: dict[str, Any],
        *,
        dataset_id: str | None = None,
    ) -> dict[str, Any]:
        client = get_openai_client()
        if client is None:
            return _default_summary(eda_profile, "OpenAI API key not configured")

        profile_json = json.dumps(eda_profile, default=str)[:120_000]
        user_prompt = SUMMARY_USER_TEMPLATE.format(eda_profile=profile_json)

        try:
            response = await client.chat.completions.create(
                model=get_llm_model(),
                messages=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2000,
            )
            content = response.choices[0].message.content or "{}"
            parsed = _parse_json_object(content)
            return _normalize_summary(parsed, eda_profile)
        except Exception as exc:
            logger.exception("generate_dataset_summary failed for %s", dataset_id)
            return _default_summary(eda_profile, str(exc)[:200])

    @classmethod
    async def generate_dataset_summary_stream(
        cls,
        eda_profile: dict[str, Any],
    ) -> tuple[dict[str, Any], str]:
        """Returns (summary dict, raw streamed text buffer for typewriter replay)."""
        client = get_openai_client()
        if client is None:
            summary = _default_summary(eda_profile, "LLM API key not configured (set GROQ_API_KEY)")
            return summary, summary["executive_summary"]

        profile_json = json.dumps(eda_profile, default=str)[:120_000]
        user_prompt = SUMMARY_USER_TEMPLATE.format(eda_profile=profile_json)
        buffer = ""

        try:
            stream = await client.chat.completions.create(
                model=get_llm_model(),
                messages=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2000,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                buffer += delta
            parsed = _parse_json_object(buffer)
            summary = _normalize_summary(parsed, eda_profile)
            return summary, buffer
        except Exception as exc:
            logger.exception("generate_dataset_summary_stream failed")
            summary = _default_summary(eda_profile, str(exc)[:200])
            return summary, summary["executive_summary"]

    @classmethod
    async def generate_chart_insight(
        cls,
        chart_config: dict[str, Any],
        chart_data: list[dict[str, Any]],
    ) -> str:
        client = get_openai_client()
        if client is None:
            return "Configure GROQ_API_KEY in .env to generate AI chart insights."

        sample = chart_data[:80]
        payload = {
            "chart": chart_config,
            "sample_rows": sample,
            "row_count_sampled": len(sample),
        }
        user = f"Chart configuration and sample data:\n{json.dumps(payload, default=str)[:14_000]}"

        try:
            response = await client.chat.completions.create(
                model=get_llm_model(),
                messages=[
                    {"role": "system", "content": CHART_INSIGHT_SYSTEM},
                    {"role": "user", "content": user},
                ],
                temperature=0.3,
                max_tokens=150,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.exception("generate_chart_insight failed")
            return f"Could not generate insight: {exc}"

    @classmethod
    async def answer_data_question(
        cls,
        question: str,
        dataset_id: str,
        sample_data: list[dict[str, Any]],
        *,
        columns_metadata: list[dict[str, Any]] | None = None,
        eda_profile: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        client = get_openai_client()
        if client is None:
            return {
                "answer": "LLM API key is not configured. Add GROQ_API_KEY to your .env file.",
                "sql_query": "-- unavailable",
                "confidence": 0.0,
                "follow_up_questions": [],
            }

        context = {
            "dataset_id": dataset_id,
            "question": question,
            "columns_metadata": (columns_metadata or [])[:40],
            "eda_profile": eda_profile or {},
            "sample_rows": sample_data[:40],
        }
        user = (
            f"{json.dumps(context, default=str)[:18_000]}\n\n"
            "Return JSON with keys: answer, sql_query, confidence (0-1), "
            "follow_up_questions (array of 3 strings)."
        )

        try:
            response = await client.chat.completions.create(
                model=get_llm_model(),
                messages=[
                    {"role": "system", "content": ASK_SYSTEM},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                temperature=0.35,
                max_tokens=800,
            )
            content = response.choices[0].message.content or "{}"
            raw = _parse_json_object(content)
            follow_ups = raw.get("follow_up_questions") or []
            if not isinstance(follow_ups, list):
                follow_ups = []
            confidence = raw.get("confidence", 0.5)
            try:
                confidence = float(confidence)
            except (TypeError, ValueError):
                confidence = 0.5
            confidence = max(0.0, min(1.0, confidence))

            return {
                "answer": str(raw.get("answer") or "No answer generated."),
                "sql_query": str(raw.get("sql_query") or "--"),
                "confidence": confidence,
                "follow_up_questions": [str(q) for q in follow_ups[:3]],
            }
        except Exception as exc:
            logger.exception("answer_data_question failed")
            return {
                "answer": f"I could not answer that question: {exc}",
                "sql_query": "--",
                "confidence": 0.0,
                "follow_up_questions": [],
            }
