#!/usr/bin/env python3
"""Shared validation and rendering for note Workspaces."""

from __future__ import annotations

import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional


SCHEMA_VERSION = 1
PRODUCT_ID = "note-workspace"
GENERATOR_VERSION = "0.4.0"

STANDARD_TASK_NAMES = {
    "strategy": "🧭 note｜戦略・編集方針",
    "tracker": "📊 note｜計測・公開ログ",
    "writer": "✍️ note｜記事制作",
    "image": "🎨 note｜画像制作",
    "diary": "📔 note｜日記・体験ログ",
    "compact": "📝 note｜執筆サポーター",
}
PRIMARY_ROLES_BY_MODE = {
    "standard_five": ("strategy", "tracker", "writer", "image", "diary"),
    "standard_four": ("strategy", "tracker", "writer", "image"),
    "compact_single": ("compact",),
}
TASK_MODES = set(PRIMARY_ROLES_BY_MODE)

PROFILE_REQUIRED = {
    "goal",
    "themes",
    "audience",
    "public_scope",
    "desired_frequency",
    "minimum_frequency",
    "capture_methods",
}
PROFILE_ALLOWED = PROFILE_REQUIRED | {
    "success_in_six_months",
    "priority_goals",
    "non_numeric_outcome",
    "avoid_topics",
    "available_time",
    "writing_preferences",
    "preferred_expressions",
    "avoid_expressions",
    "image_preferences",
    "image_avoid",
}
OPERATION_REQUIRED = {
    "locale",
    "timezone",
    "note_draft_registration",
    "metrics_tracking",
    "weekly_planning",
}
OPERATION_ALLOWED = OPERATION_REQUIRED | {
    "automation_preferences",
    "cloud_sync",
    "task_mode",
}
TOP_LEVEL_ALLOWED = {"schema_version", "profile", "operation", "task_names"}
TASK_NAME_ALLOWED = set(STANDARD_TASK_NAMES)
SENSITIVE_KEY_PARTS = {
    "password",
    "passwd",
    "api_key",
    "apikey",
    "cookie",
    "secret",
    "access_token",
    "refresh_token",
    "credential",
    "auth_code",
    "private_url",
}


class SetupConfigError(ValueError):
    """Raised when setup input is unsafe or does not match schema version 1."""


def _path_label(parts: Iterable[str]) -> str:
    joined = ".".join(parts)
    return joined or "config"


def _reject_sensitive_keys(value: Any, path: tuple[str, ...] = ()) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower().replace("-", "_")
            if any(part in normalized for part in SENSITIVE_KEY_PARTS):
                raise SetupConfigError(
                    f"{_path_label(path + (str(key),))} is not allowed in setup config"
                )
            _reject_sensitive_keys(child, path + (str(key),))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_sensitive_keys(child, path + (str(index),))


def _require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SetupConfigError(f"{label} must be an object")
    return value


def _check_keys(
    value: dict[str, Any],
    *,
    label: str,
    allowed: set[str],
    required: Optional[set[str]] = None,
) -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise SetupConfigError(f"{label} has unknown fields: {', '.join(unknown)}")
    missing = sorted((required or set()) - set(value))
    if missing:
        raise SetupConfigError(f"{label} is missing fields: {', '.join(missing)}")


def _string(value: Any, label: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise SetupConfigError(f"{label} must be a string")
    cleaned = value.strip()
    if not cleaned and not allow_empty:
        raise SetupConfigError(f"{label} must not be empty")
    if len(cleaned) > 4000:
        raise SetupConfigError(f"{label} is too long")
    return cleaned


def _string_list(
    value: Any, label: str, *, allow_empty: bool = True
) -> list[str]:
    if not isinstance(value, list):
        raise SetupConfigError(f"{label} must be an array")
    if not value and not allow_empty:
        raise SetupConfigError(f"{label} must contain at least one item")
    output: list[str] = []
    for index, item in enumerate(value):
        cleaned = _string(item, f"{label}[{index}]")
        if cleaned not in output:
            output.append(cleaned)
    return output


def _boolean(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise SetupConfigError(f"{label} must be true or false")
    return value


def _optional_string(value: dict[str, Any], key: str) -> str:
    if key not in value or value[key] is None:
        return ""
    return _string(value[key], f"profile.{key}", allow_empty=True)


def _automation_preference(
    value: Any,
    label: str,
    *,
    feature_enabled: bool,
) -> dict[str, Any]:
    preference = _require_object(value, label)
    _check_keys(
        preference,
        label=label,
        allowed={"requested", "schedule"},
        required={"requested", "schedule"},
    )
    requested = _boolean(preference["requested"], f"{label}.requested")
    schedule_value = preference["schedule"]
    if requested:
        if not feature_enabled:
            raise SetupConfigError(
                f"{label}.requested requires the matching feature to be enabled"
            )
        if schedule_value is None:
            raise SetupConfigError(
                f"{label}.schedule is required when automation is requested"
            )
        schedule = _string(schedule_value, f"{label}.schedule")
    else:
        if schedule_value is not None:
            raise SetupConfigError(
                f"{label}.schedule must be null when automation is not requested"
            )
        schedule = None
    return {"requested": requested, "schedule": schedule}


def normalize_setup_config(raw: Any) -> dict[str, Any]:
    """Validate and normalize a version 1 setup config."""

    config = _require_object(copy.deepcopy(raw), "config")
    _reject_sensitive_keys(config)
    _check_keys(
        config,
        label="config",
        allowed=TOP_LEVEL_ALLOWED,
        required={"schema_version", "profile", "operation"},
    )
    if config["schema_version"] != SCHEMA_VERSION:
        raise SetupConfigError(
            f"schema_version must be {SCHEMA_VERSION}, got {config['schema_version']!r}"
        )

    profile = _require_object(config["profile"], "profile")
    _check_keys(
        profile,
        label="profile",
        allowed=PROFILE_ALLOWED,
        required=PROFILE_REQUIRED,
    )
    profile["goal"] = _string(profile["goal"], "profile.goal")
    profile["themes"] = _string_list(
        profile["themes"], "profile.themes", allow_empty=False
    )
    profile["audience"] = _string(profile["audience"], "profile.audience")
    profile["public_scope"] = _string(
        profile["public_scope"], "profile.public_scope"
    )
    profile["desired_frequency"] = _string(
        profile["desired_frequency"], "profile.desired_frequency"
    )
    profile["minimum_frequency"] = _string(
        profile["minimum_frequency"], "profile.minimum_frequency"
    )
    profile["capture_methods"] = _string_list(
        profile["capture_methods"], "profile.capture_methods", allow_empty=False
    )
    for key in (
        "success_in_six_months",
        "non_numeric_outcome",
        "available_time",
        "writing_preferences",
        "image_preferences",
    ):
        profile[key] = _optional_string(profile, key)
    for key in (
        "priority_goals",
        "avoid_topics",
        "preferred_expressions",
        "avoid_expressions",
        "image_avoid",
    ):
        profile[key] = _string_list(profile.get(key, []), f"profile.{key}")

    operation = _require_object(config["operation"], "operation")
    _check_keys(
        operation,
        label="operation",
        allowed=OPERATION_ALLOWED,
        required=OPERATION_REQUIRED,
    )
    operation["locale"] = _string(operation["locale"], "operation.locale")
    operation["timezone"] = _string(operation["timezone"], "operation.timezone")
    if not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._+-]*(?:/[A-Za-z0-9][A-Za-z0-9._+-]*)*",
        operation["timezone"],
    ):
        raise SetupConfigError("operation.timezone must be an IANA-style timezone name")
    if not re.fullmatch(r"[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", operation["locale"]):
        raise SetupConfigError("operation.locale must be a language or locale tag")
    for key in (
        "note_draft_registration",
        "metrics_tracking",
        "weekly_planning",
    ):
        operation[key] = _boolean(operation[key], f"operation.{key}")

    task_mode = operation.get("task_mode", "standard_five")
    if task_mode not in TASK_MODES:
        raise SetupConfigError(
            "operation.task_mode must be standard_five, standard_four or compact_single"
        )
    operation["task_mode"] = task_mode

    automation = _require_object(
        operation.get(
            "automation_preferences",
            {
                "tracking": {"requested": False, "schedule": None},
                "weekly_planning": {"requested": False, "schedule": None},
            },
        ),
        "operation.automation_preferences",
    )
    _check_keys(
        automation,
        label="operation.automation_preferences",
        allowed={"tracking", "weekly_planning"},
        required={"tracking", "weekly_planning"},
    )
    automation = {
        "tracking": _automation_preference(
            automation["tracking"],
            "operation.automation_preferences.tracking",
            feature_enabled=operation["metrics_tracking"],
        ),
        "weekly_planning": _automation_preference(
            automation["weekly_planning"],
            "operation.automation_preferences.weekly_planning",
            feature_enabled=operation["weekly_planning"],
        ),
    }
    operation["automation_preferences"] = automation

    cloud_sync = _require_object(
        operation.get("cloud_sync", {"enabled": False, "provider": None}),
        "operation.cloud_sync",
    )
    _check_keys(
        cloud_sync,
        label="operation.cloud_sync",
        allowed={"enabled", "provider"},
        required={"enabled", "provider"},
    )
    enabled = _boolean(cloud_sync["enabled"], "operation.cloud_sync.enabled")
    if enabled:
        raise SetupConfigError("This setup supports local storage only; cloud_sync.enabled must be false")
    if cloud_sync["provider"] is not None:
        raise SetupConfigError("cloud_sync.provider must be null while cloud sync is disabled")
    operation["cloud_sync"] = {"enabled": False, "provider": None}

    task_names = _require_object(config.get("task_names", {}), "task_names")
    _check_keys(task_names, label="task_names", allowed=TASK_NAME_ALLOWED)
    normalized_names = dict(STANDARD_TASK_NAMES)
    if task_mode == "standard_four":
        normalized_names.pop("diary")
        if "diary" in task_names:
            raise SetupConfigError("diary requires standard_five or compact_single")
    for key, value in task_names.items():
        task_name = _string(value, f"task_names.{key}")
        if "\n" in task_name or "\r" in task_name:
            raise SetupConfigError(f"task_names.{key} must be one line")
        if len(task_name) > 200:
            raise SetupConfigError(f"task_names.{key} must be 200 characters or fewer")
        normalized_names[key] = task_name

    return {
        "schema_version": SCHEMA_VERSION,
        "profile": profile,
        "operation": operation,
        "task_names": normalized_names,
    }


def load_setup_config(path: str) -> dict[str, Any]:
    if path == "-":
        import sys

        raw = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    return normalize_setup_config(raw)


def parse_timestamp(value: Optional[str]) -> tuple[str, datetime]:
    if value is None:
        moment = datetime.now().astimezone().replace(microsecond=0)
    else:
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise SetupConfigError("timestamp must be ISO 8601 with a timezone") from exc
        if moment.tzinfo is None:
            raise SetupConfigError("timestamp must include a timezone")
        moment = moment.replace(microsecond=0)
    normalized = moment.isoformat()
    if normalized.endswith("+00:00"):
        normalized = normalized[:-6] + "Z"
    return normalized, moment


def validate_workspace_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{7,63}", value):
        raise SetupConfigError(
            "workspace_id must be 8-64 lowercase ASCII letters, digits, or hyphens"
        )
    return value


def _inline(value: str) -> str:
    return " ".join(value.split()) if value else "まだ決めていません。"


def _bullets(values: list[str]) -> str:
    if not values:
        return "- まだ決めていません。"
    return "\n".join(f"- {_inline(value)}" for value in values)


def _nested_bullets(values: list[str]) -> str:
    if not values:
        return "  - まだ決めていません。"
    return "\n".join(f"  - {_inline(value)}" for value in values)


def render_creator_profile(profile: dict[str, Any]) -> str:
    return f"""# 作成者プロフィール

このファイルは、note運用で繰り返し参照する目的と公開範囲を記録します。一次情報の原文や記事本文は別の場所へ保存します。

## noteで達成したいこと

{_inline(profile['goal'])}

## 半年後の成功

{_inline(profile['success_in_six_months'])}

## 優先する目標

{_bullets(profile['priority_goals'])}

## 数字以外に残したいもの

{_inline(profile['non_numeric_outcome'])}

## 読んでほしい人

{_inline(profile['audience'])}

## 中心テーマ

{_bullets(profile['themes'])}

## 避けるテーマ

{_bullets(profile['avoid_topics'])}

## 公開できる範囲

{_inline(profile['public_scope'])}

## 継続条件

- 使える時間: {_inline(profile['available_time'])}
- 希望頻度: {_inline(profile['desired_frequency'])}
- 最低限の頻度: {_inline(profile['minimum_frequency'])}
- 残しやすい方法: {'、'.join(profile['capture_methods'])}
"""


def render_style_profile(profile: dict[str, Any]) -> str:
    avoid = profile["avoid_expressions"]
    image_avoid = profile["image_avoid"]
    avoid_text = _bullets(avoid) if avoid else "- まだ決めていません。"
    preferred_text = _bullets(profile["preferred_expressions"])
    image_text = _nested_bullets(image_avoid)
    return f"""# note文体プロフィール

## 基本の語り口

{_inline(profile['writing_preferences'])}

## 文のリズム

まだ決めていません。実際の記事と利用者の修正から更新します。

## 導入

まだ決めていません。記事ごとの目的を優先します。

## 見出しと構成

まだ決めていません。記事ごとの構成承認を優先します。

## 具体性

本人の場面、会話、観察、判断を中心にし、架空の経験で補いません。

## 好む表現

{preferred_text}

## 避ける表現

{avoid_text}

## 記事ごとに選ぶこと

- トーン、長さ、ユーモア、画像表現は記事ごとに確認します。
- 画像の希望: {_inline(profile['image_preferences'])}
- 画像で避けるもの:
{image_text}

## 絶対に作らないもの

- 架空の経験、感情、成果、数字、引用。
- 公開範囲が確認できない個人情報や第三者情報。
"""


def render_strategy(profile: dict[str, Any], operation: dict[str, Any]) -> str:
    return f"""# note運用方針

## 最優先の目的

{_inline(profile['goal'])}

## 想定読者

{_inline(profile['audience'])}

## 中心テーマ

{_bullets(profile['themes'])}

## 投稿頻度

- 運用状態: 継続中
- 希望: {_inline(profile['desired_frequency'])}
- 最低限: {_inline(profile['minimum_frequency'])}
- 使える時間: {_inline(profile['available_time'])}

## 一次情報の残し方

{_bullets(profile['capture_methods'])}

## 公開範囲

{_inline(profile['public_scope'])}

## 任意機能

- note新規下書き登録: {'使う予定。記事ごとに完成後の承認が必要です。' if operation['note_draft_registration'] else '使いません。'}
- 参考指標の記録: {'使います。' if operation['metrics_tracking'] else '使いません。'}
- 週間企画: {'使います。' if operation['weekly_planning'] else '使いません。'}
- クラウド同期: 初期設定では使いません。

指標は項目ごとに分け、取得不能を`0`として扱いません。投稿テーマは指標だけで自動決定しません。
"""


def render_role_task_plan(
    task_names: dict[str, str], operation: dict[str, Any]
) -> str:
    tracking = operation["automation_preferences"]["tracking"]
    planning = operation["automation_preferences"]["weekly_planning"]
    mode = operation["task_mode"]
    mode_label = {
        "standard_five": "5タスク標準運用",
        "standard_four": "4タスク従来運用",
        "compact_single": "1タスク簡易運用",
    }[mode]
    diary_name = task_names.get("diary", STANDARD_TASK_NAMES["diary"])
    has_diary = mode != "standard_four"
    new_tasks = "、".join(task_names[role] for role in ("tracker", "writer", "image"))
    if has_diary:
        new_tasks += f"、{diary_name}の4タスク"
    else:
        new_tasks += "の3タスク"
    diary_section = f"""
### {diary_name}

- 役割: 日々の出来事、気持ち、違和感を話せる日記担当。記事を書く予定がなくても使えます。
- Skill: `note-source-log`。会話の保存方法は同Skillの日記モードとデータ契約を読みます。
- 開始指示: 共通の運用ガイドと継続指示を読み、「日々の出来事や気持ちを、そのまま話せる場所です。『今日はこんなことがあった』『何か質問して』から始められます。ここでの会話はこのworkspaceへ記録します。残したくない話は『保存しないで』と伝えてください。記事に使う時は公開範囲を確認します」と案内します。準備確認の返答自体は日記へ保存しません。
- 利用者の原文とAIの質問・返答を話者別に追記します。質問から始められ、回答や教訓を強制しません。毎回記事化を提案しません。
- 会話の原文は`primary-log/`、検索用の材料は`source-cards/`へ残します。戦略と執筆は同じ記録を参照し、AI発言を本人の一次情報として使いません。
""" if has_diary else ""
    return f"""# 役割別タスク計画

このファイルは、利用者に見えるタスクの役割、開始指示、受け渡しを記録します。選択中の構成は**{mode_label}**です。このファイルだけではタスクや定期実行を作成済みとは扱いません。

## 利用者への案内原則

- 各担当は同じworkspaceで連携します。記事を書く時と、日々の話を残す時に合う窓口を案内します。
- 全タスクが同じworkspaceを参照します。利用者へ会話、記事、画像、設定のコピーや手動の橋渡しを求めません。
- 標準構成では、現在のセットアップタスク自身を最初に{task_names['strategy']}へtitle変更し、公式host read-backで同じタスクだと確認します。strategyを別タスクとして新規作成せず、新しく作るのは{new_tasks}だけです。
- 現在タスクのtitle変更または公式read-backを確認できない場合は、新しい役割タスクを一つも作らず停止します。セットアップタスクを残したまま別strategyを作る構成へ、利用者の明示承認なしに切り替えません。
- 標準構成では、迷った時と普段の記事制作は{task_names['writer']}を入口として案内します。
- {task_names['tracker']}と{task_names['image']}は、通常の記事制作では利用者が自分で開かなくてもよいことを伝えます。
- 1タスク簡易運用では{task_names['compact']}だけへ話しかければよいと伝えます。
- 最初の案内は内部Skill名の説明ではなく、自分を使う場面、普段開く必要があるか、最初の一言の例を短く示します。

## 標準構成

### {task_names['strategy']}

- 役割: 初回セットアップを引き継ぐ戦略担当。目的、読者、テーマ、投稿ペース、文体・トーンの参照元を整えます。
- Skill: `note-strategist`。文体参照を作り直す時は`note-style-profile`を使います。
- 継続運用: 利用者の既存目標から主な分析レンズを一つ選び、計測タスクの最新記録、一次情報カード、記事台帳、必要な公開情報を分けて読み、その週の推奨テーマを記録します。
- 開始指示: `START_HERE.md`、`STUDIO.md`、`strategy/`、`profile/`を読み、担当範囲と現在の設定を確認してから「ここでは運用方針と今週の候補を一緒に整えます。普段の記事制作は{task_names['writer']}を使ってください」と利用者へ案内します。
- このタスクの会話だけを正本にせず、永続的な変更はworkspaceへ記録します。

### {task_names['tracker']}

- 役割: 公開ログと、現行ブラウザ版の5指標、必要なアカウント流入元を、対象期間、scope、集計時刻、取得元、取得状態を分けて記録します。旧viewsは現行指標へ変換しません。
- Skill: `note-tracker`。
- 開始指示: `START_HERE.md`、`STUDIO.md`、運用設定、strategy、creator profile、metrics契約を読み、platformで定期実行の作成済み状態を確認できた場合だけ、「ここでは公開後の記録を残します。目的に必要な範囲だけ確認します。定期実行が作成済みなら基本的に自動で動くため、手動で確認したい時以外は普段開かなくても構いません。取得できない値を0にはしません」と案内します。確認できない場合は、自動実行の状態は未確認だと伝えます。
- 記事の良し悪しや次テーマを単独で決めず、記録を戦略担当が読めるworkspaceへ残します。

### {task_names['writer']}

- 役割: 利用者が普段記事を書くメイン窓口。今週の候補も、利用者が今書きたい別テーマも扱います。
- 開始指示: `START_HERE.md`、`STUDIO.md`、運用設定、継続指示、文体プロフィールを読み、「ここが普段の記事制作窓口です。迷った時も、まずここへ話しかけてください。『今日はこの話を書きたい』『このメモを残して』から、完成原稿、画像確認、必要ならnote下書き登録まで一つの流れで支えます」と案内します。
- Skill: `note-writer`。メモ保存には共有の`note-source-log`を使えます。
- 原稿を利用者へ返す直前に`note-draft-quality`を内部で使い、一次性と文体を確認します。品質結果は付けず、修正済みの原稿だけを返します。
- 現在の`profile/style-profile.md`を読みますが、今回の記事で明示されたトーンを常に優先します。
- タイトル選択と記事revisionの検証後、画像タスクへbriefを送り、QA済み画像が戻るまで制作フローを保持します。
- 完成記事と戻ってきた画像を利用者へ納品してから、その一件への明示承認がある時だけ`note-draft`へつなぎます。

### {task_names['image']}

- 役割: 確定タイトルと記事の小さなbriefから、見出し画像と希望済みの差し絵を制作します。毎記事で使い回す利用者向けタスクです。
- Skill: `note-image`。
- 開始指示: `START_HERE.md`、`STUDIO.md`、画像制作契約、継続指示を読み、「ここでは記事ごとの画像を制作し、実寸と小表示を確認して{task_names['writer']}へ返します。通常は記事制作担当から依頼を受けるため、画像だけを直接調整したい時以外は自分で開かなくても構いません」と案内します。
- 画像を作って終わりにせず、asset registryへの保存、実寸・小表示QA、執筆タスクへの完了報告まで担当します。
- 同時制作や長期化で分ける必要がある時だけ、利用者の承認を得て追加の利用者向け画像タスクを作れます。隠れたsubtaskを標準にしません。

{diary_section}
## 1タスク簡易運用

### {task_names['compact']}

- 役割: 戦略、計測、記事制作、画像制作、日記を一つの会話で扱います。
- 開始指示: `START_HERE.md`、`STUDIO.md`、運用設定、継続指示を読み、「普段はこのタスクへ話しかけてください。『今日はこの話を書きたい』『次は何を書こう？』『このメモを残して』のどれからでも始められます」と案内します。
- 標準運用と同じworkspace正本、承認境界、品質ゲートを使います。役割が一つになっても、記事ごとの画像QAや下書き承認を省略しません。
- 後から5タスク標準運用へ切り替える時は、構造的設定変更としてtask、title、開始指示、ready bindingを再確認します。設定fileだけで切り替え済みとは扱いません。

## 共通の正本と受け渡し

- 永続的な利用者指示: `profile/standing-instructions.md`
- 文体: `profile/style-profile.md`
- 戦略: `strategy/strategy.md`と`plans/weekly/`
- 公開ログと指標: `articles/registry.jsonl`と`metrics/history.jsonl`
- タスクの準備完了記録: `strategy/role-task-bindings.jsonl`
- 新規の標準構成は日記担当を含む5タスクです。どの役割からも`note-source-log`で同じworkspaceへ保存でき、従来の4タスク構成でもその共有機能を使えます。
- 現在の記事で明示された指示は、継続指示や文体プロフィールより優先します。「今後も」「毎回」等の継続意思が明確な時だけread-back後に永続化します。

## タスク作成の完了条件

- 選択された構成の全タスクに、承認済みタイトル、同じworkspace、上記の開始指示が渡っている。
- 各タスクが利用者向けに担当範囲と準備完了を返している。空のタスクを作っただけで完了にしない。
- 実際のtask ID、title、role、ready確認を`strategy/role-task-bindings.jsonl`へ記録し、binding validatorがpassする。
- 実行環境がタスク作成に対応しない場合は、空タスクや偽のIDを記録せず、同じ開始指示を利用者へ渡します。

## 定期実行の希望

- 計測: {('希望あり。予定は「' + tracking['schedule'] + '」。trackerタスクを対象にします。') if tracking['requested'] else '希望なし。'}
- 週間戦略: {('希望あり。予定は「' + planning['schedule'] + '」。strategyタスクを対象にします。') if planning['requested'] else '希望なし。'}
- 両方を使う場合は、計測を先に完了させ、戦略担当が同じ週の取得状態を確認してから候補を更新します。

希望があっても、このファイルだけでは定期実行を作成しません。
"""


def render_standing_instructions(
    instructions: Optional[list[dict[str, str]]] = None,
) -> str:
    current = instructions or []
    current_text = (
        "\n".join(
            f"- [{item['category']}] {item['text']} (`{item['instruction_id']}`)"
            for item in current
        )
        if current
        else "- まだありません。"
    )
    return f"""# 継続指示

このファイルは、複数のタスクで毎回守る利用者の指示だけを記録する正本です。記事一件だけの指定、未確認の推測、会話の要約は入れません。

## 現在の継続指示

{current_text}

## 記録するときのルール

- 利用者が「今後も」「毎回」「これからは」等で継続意思を明示した時だけ、保存する文面を短くread-backしてから更新します。
- 記事一件だけの指示は、その記事のcontext packまたはarticle packageへ保存します。
- 文体だけの指示は`profile/style-profile.md`、目標や頻度は`strategy/strategy.md`と運用設定へ分けます。
- 現在の記事で利用者が明示した指示は、このファイルより優先します。
- 曖昧な時は永続化せず、確認を一つだけ行います。
"""


def build_standing_instruction_state(
    workspace_id: str, created_at: str
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "workspace_id": workspace_id,
        "revision": 0,
        "updated_at": created_at,
        "latest_event_id": None,
        "instructions": [],
    }


def build_manifest(workspace_id: str, created_at: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "product_id": PRODUCT_ID,
        "generator_version": GENERATOR_VERSION,
        "workspace_id": workspace_id,
        "created_at": created_at,
        "updated_at": created_at,
        "data_owner": "user",
        "runtime_guide": "STUDIO.md",
        "status": "ready",
    }


def build_operating_settings(
    config: dict[str, Any], workspace_id: str, created_at: str
) -> dict[str, Any]:
    profile = config["profile"]
    operation = config["operation"]
    return {
        "schema_version": SCHEMA_VERSION,
        "workspace_id": workspace_id,
        "updated_at": created_at,
        "lifecycle": {
            "phase": "operation",
            "runtime_guide": "STUDIO.md",
            "setup_skill": "note-workspace-setup",
            "user_entry": "natural_language",
        },
        "locale": operation["locale"],
        "timezone": operation["timezone"],
        "storage": {
            "mode": "local",
            "workspace_root": ".",
            "cloud_sync": {"enabled": False, "provider": None},
        },
        "cadence": {
            "status": "active",
            "desired_frequency": profile["desired_frequency"],
            "minimum_frequency": profile["minimum_frequency"],
        },
        "capture": {"methods": profile["capture_methods"]},
        "features": {
            "note_draft_registration": {
                "enabled": operation["note_draft_registration"],
                "approval_mode": "per_article_after_final_assets",
                "publish": False,
                "overwrite_existing_draft": False,
            },
            "metrics_tracking": {
                "enabled": operation["metrics_tracking"],
                "unavailable_value": "unavailable",
            },
            "weekly_planning": {"enabled": operation["weekly_planning"]},
        },
        "automation_preferences": {
            "tracking": {
                "requested": operation["automation_preferences"]["tracking"][
                    "requested"
                ],
                "schedule": operation["automation_preferences"]["tracking"][
                    "schedule"
                ],
                "target_role": "tracker",
            },
            "weekly_planning": {
                "requested": operation["automation_preferences"][
                    "weekly_planning"
                ]["requested"],
                "schedule": operation["automation_preferences"][
                    "weekly_planning"
                ]["schedule"],
                "target_role": "strategy",
                "runs_after": "tracking",
            },
        },
        "task_topology": {
            "mode": operation["task_mode"],
            "binding_generation": 1,
            "shared_source_log": True,
            "binding_registry": "strategy/role-task-bindings.jsonl",
            "ready_message_required": True,
            "extra_image_tasks": "explicit_approval_only",
        },
        "task_names": config["task_names"],
    }


def render_workspace_readme(workspace_id: str) -> str:
    return f"""# note Workspace 作業場所

このフォルダは利用者が所有する`note Workspace｜ROGNALIA`の作業場所です。

- 作業場所ID: `{workspace_id}`
- 最初に読む利用者向けガイド: `START_HERE.md`
- AI向けの通常運用ガイド: `STUDIO.md`
- 運用方針: `strategy/strategy.md`
- 運用設定: `strategy/operating-settings.json`
- 継続指示: `profile/standing-instructions.md`
- 役割別タスク: `strategy/role-task-plan.md`
- 一次情報の原文: `primary-log/`
- 再利用する一次情報: `source-cards/`
- 記事別の文脈: `context-packs/`
- 週間計画: `plans/weekly/`
- 記事と台帳: `articles/`
- 参考指標: `metrics/`
- 画像: `assets/`

認証情報、API key、Cookie、第三者の秘密は保存しません。取得できなかった指標は`0`ではなく、取得不能の状態として記録します。
"""


def render_start_here(
    task_names: dict[str, str], operation: dict[str, Any]
) -> str:
    mode = operation["task_mode"]
    tracking = operation["automation_preferences"]["tracking"]
    planning = operation["automation_preferences"]["weekly_planning"]

    if operation["metrics_tracking"]:
        if tracking["requested"]:
            tracking_status = (
                f"使う設定です。定期実行は「{_inline(tracking['schedule'] or '')}」を希望しています。"
            )
        else:
            tracking_status = (
                "使う設定ですが、定期実行は希望していません。必要な時に手動で依頼します。"
            )
    else:
        tracking_status = "現在は使わない設定です。"

    if operation["weekly_planning"]:
        if planning["requested"]:
            planning_status = (
                f"使う設定です。定期実行は「{_inline(planning['schedule'] or '')}」を希望しています。"
            )
        else:
            planning_status = (
                "使う設定ですが、定期実行は希望していません。必要な時に戦略担当へ依頼します。"
            )
    else:
        planning_status = "現在は使わない設定です。"

    draft_status = (
        "使う設定です。記事と画像の完成後、その記事について確認を受けてから新規下書きへ登録します。"
        if operation["note_draft_registration"]
        else "現在は使わない設定です。記事と画像の納品まで行います。"
    )

    settings_notice = (
        "この欄は選択した設定です。担当タスクの準備状況と定期実行の対象・次回実行時刻は、"
        "セットアップ完了時に案内します。最新の状態は利用中のアプリから確認します。"
        "確認できない場合は「未確認」と案内します。"
        "\n\n現在の準備状況と次回実行は、普段のタスクへ次のように聞けます。"
        "\n\n```text\n今使える担当と、定期計測・週間企画の次回実行を確認して。\n```"
    )

    if mode == "compact_single":
        return f"""# note Workspace はじめに

## 30秒で分かる使い方

普段は「{task_names['compact']}」へ話しかけます。戦略、計測、記事制作、画像制作、日記を同じ会話の中で切り替えるため、利用者が担当を選び分ける必要はありません。

- 記事を書く: 「今日はこの話を書きたい」
- 次のテーマを考える: 「次は何を書こう？」
- 材料を残す: 「このメモを残して」
- 日記を話す: 「今日あったことを聞いて」「何か質問して」
- 迷った時: そのまま、このタスクへ相談する

## 現在の設定

- 参考指標の記録: {tracking_status}
- 週間企画: {planning_status}
- note新規下書き登録: {draft_status}

{settings_notice}

## 5タスクへ分けたい時

「日記も含めた5タスクに分けたい」とこのタスクへ伝えてください。保存済みの情報を保ったままセットアップ手順へ戻ります。

## 保存先

詳しい運用ルールは`STUDIO.md`、目的や設定は`profile/`と`strategy/`に保存されています。
"""

    has_diary = mode == "standard_five"
    new_tasks = "計測、記事制作、画像制作、日記の4タスク" if has_diary else "計測、記事制作、画像制作の3タスク"
    count = 5 if has_diary else 4
    diary_entry = (
        f"日々の出来事や気持ちを残す時は「{task_names['diary']}」へ。『今日あったことを聞いて』『何か質問して』で始められます。\n\n"
        if has_diary else ""
    )
    diary_guide = f"""### {task_names['diary']}

出来事、気持ち、まだまとまらない考えを、そのまま話せます。話題に迷ったら質問を頼めます。ここでの会話は日時と話者を分けて、このworkspaceへ保存します。残したくない話は「保存しないで」と伝えてください。

記事を書く予定がなくても使えます。テーマを考える時や記事を書く時は、関係する記録を参照できます。保存した話を記事に使う時は、公開できる範囲を確認します。

""" if has_diary else ""
    return f"""# note Workspace はじめに

## 30秒で分かる使い方

セットアップに使ったタスクは、完了後に「{task_names['strategy']}」へ名前が変わり、そのまま戦略担当になります。新しく増えるのは、{new_tasks}です。

{diary_entry}記事を書く時は「{task_names['writer']}」へ話しかけます。

1. 「{task_names['writer']}」には「今日はこの話を書きたい」「この記事を整えたい」と頼めます。
2. 次に何を書くか考える時や、運用方針を見直す時は「{task_names['strategy']}」を使います。
3. 担当タスクが準備済みなら、「{task_names['tracker']}」と「{task_names['image']}」は、通常の記事制作では自分で開かなくても構いません。
4. 迷った時は、まず「{task_names['writer']}」へ話しかけてください。

{count}つの担当は同じworkspaceを見ています。利用者が会話やファイルをコピーして、担当間を運ぶ必要はありません。

## 使い分け

{diary_guide}### {task_names['writer']}

普段の記事制作窓口です。今週の候補でも、今書きたい別テーマでも対応します。材料整理、必要な調査、構成、本文、タイトル、画像確認、希望時のnote下書き登録まで、一つの流れで進めます。

話しかけ方: 「今日はこの出来事を書きたい」「今週の候補は？」「このメモを残して」

### {task_names['strategy']}

次に何を書くか、どの方向を大切にするかを整えます。記事や反応の記録をもとに、今週の候補や投稿頻度を相談できます。

話しかけ方: 「次は何を書こう？」「今週のテーマを相談したい」「投稿頻度を見直したい」

### {task_names['tracker']}

公開記事と、対象期間を揃えたインプレッション、ページビュー、スキ、コメント、売上を記録します。

記録した数字は、戦略担当との振り返りに使えます。

### {task_names['image']}

記事制作担当と連携し、記事に合わせた画像を作ります。実寸と小さな表示で確認し、記事のフォルダへ保存します。画像だけを直接調整したい時は、このタスクへ依頼できます。

## 現在の設定

- 参考指標の記録: {tracking_status}
- 週間企画: {planning_status}
- note新規下書き登録: {draft_status}

{settings_notice}

## 1タスクへまとめたい時

「担当を一つの執筆サポーターにまとめたい」と普段のタスクへ伝えてください。保存済みの情報を保ったままセットアップ手順へ戻ります。

## 保存先

詳しい運用ルールは`STUDIO.md`、目的や設定は`profile/`と`strategy/`に保存されています。
"""


def render_runtime_guide() -> str:
    return """# note Workspace 役割分担運用ガイド

このworkspaceは初回セットアップを完了し、通常運用へ引き継がれています。このファイルがhost共通の通常運用の正本です。利用者向けの短い使い方は`START_HERE.md`にあります。新規の標準は戦略、計測、記事制作、画像制作、日記の5タスクです。希望時は1タスク簡易運用、既存環境では従来の4タスクも使えます。実際の構成は運用設定とready bindingで確認します。

## どのタスクでも最初に行うこと

1. `workspace.json`と`strategy/operating-settings.json`を読み、workspace ID、運用フェーズ、task mode、利用可能な機能を確認します。
2. `profile/standing-instructions.md`と`strategy/strategy.md`を読みます。
3. 自分の役割と開始指示は`strategy/role-task-plan.md`で確認します。
4. 戦略、目的別の計測、記事制作では`profile/creator-profile.md`を読みます。記事を書く時だけ`profile/style-profile.md`と該当する`context-packs/`も読みます。

会話履歴だけを継続運用の正本にしません。`primary-log/`全体を毎回読みません。必要な材料は一次情報カードと記事別の文脈パックから選びます。

`strategy/operating-settings.json`の`automation_preferences`は、利用者が希望した曜日と時刻の記録です。定期実行が現在も存在する、動いている、次回いつ動くという外部状態の証拠にはしません。定期実行を作成、変更、再実行、状態報告する前は、adapterが利用中のplatformから実際のID、対象task、schedule、次回実行を読み戻します。読み戻せない時は「未確認」とし、作成済みとも未作成とも断定せず、重複作成しません。

## 利用者との話し方

- 利用者にSkill ID、内部タスク名、保存形式を選ばせません。
- 「今週の候補は？」「今日はこれを書きたい」「このメモを残して」のような自然な依頼から目的を判断します。
- 日々の話は日記担当、記事を書く時は記事制作が入口です。日記担当のない構成では同じ会話で`note-source-log`を使えます。迷った時は記事制作へ案内し、利用者へ手動の情報運搬を求めません。
- 本人の経験、観察、言葉、判断を中心にし、足りない本人情報だけを短く確認します。
- 現在の記事で明示された指示を最優先し、次に`profile/standing-instructions.md`、その次に文体プロフィールと戦略の既定値を使います。
- 「今後も」「毎回」等の継続意思が明確な指示だけを、保存内容のread-back後に適切な正本へ記録します。記事一件だけの指示を全体ルールへ広げません。

## 5つの役割

### 日記・体験ログ

- `note-source-log`を使い、出来事を話す、質問してもらう、続きを話す、という日常の入口を担当します。setupの準備確認だけでは日記保存を開始しません。
- 日記担当への会話は選択済みworkspaceへ原文を追記します。他の担当や簡易運用では日記・記録の依頼がある会話だけが対象です。保存しない指定、回答をやめる意思、公開範囲を優先します。
- 利用者の原文とAIの質問・返答を話者別に保存し、会話IDと親ログIDでつなぎます。会話履歴を読めない時は見えていない発言を復元しません。
- 質問を頼まれたら一つずつ自然に聞き、学び、結論、記事化を迫りません。記録だけで終わって構いません。
- 本人の発言から必要な検索用カードを作り、戦略・記事制作は関係するカードと元ログだけを参照します。AI発言は本人の体験や引用の根拠にしません。保存の承認を記事使用の承認にしません。

### 戦略・編集方針

- `note-strategist`を使い、初回セットアップを引き継いで目的、読者、テーマ、頻度、文体・トーンの参照元を整えます。
- 週間実行では、利用者の既存目標から主な分析レンズを一つ、必要なら副レンズを一つ選び、計測の対象期間・scope・集計時刻・状態、最新の一次情報カード、記事台帳、必要な公開情報を分けて読みます。
- 利用者が不在の定期実行では、その週の`strategy_recommendation`を記録できます。これは利用者の確定判断ではありません。
- 利用者が採用、修正、差し替え、休止、または別テーマを選んだ時は`user_selection`として記録します。別テーマを選んでも記事制作を止めません。
- 目標、頻度、継続・休止状態の変更は、その変更への明示承認後だけ履歴付きで更新します。

### 計測・公開ログ

- `note-tracker`を使い、公開記事とアカウント全体について、現行ブラウザ版の5指標と必要な流入元を期間、scope、集計時刻、取得元、status付きで記録します。
- 旧viewsと現行指標を混ぜず、`not_collected`、`unavailable`、`not_visible`、`fetch_failed`を`0`へ変えません。
- 計測結果だけで記事の良し悪しや次テーマを決めず、戦略担当が読めるworkspaceへ観測を残します。
- 戦略の定期実行と併用する場合は計測を先に行い、戦略担当は古い値や失敗を最新値と装いません。

### 記事制作

- `note-writer`を使い、週間候補でも利用者が今書きたい別テーマでも、材料確認、必要な調査、短い取材、構成、本文、タイトル、タグ、X投稿文を一記事ずつ進めます。
- 計画外テーマは`direction_source: user_request`として記録でき、先に週間計画を書き換える必要はありません。
- 原稿を返す直前に`note-draft-quality`を内部で使い、本人固有の一次性と文体を確認します。品質チェック結果、点数、修正一覧、内部工程名を原稿へ付けません。
- 利用者がタイトルを選び、記事revisionの保存と検証を終えてから、画像制作タスクへ小さなbriefを渡します。
- 画像制作の完了報告とQA済みassetを受け取り、記事と画像を一緒に利用者へ納品するまで制作フローを保持します。
- 納品後だけ「noteの下書き登録まで進めますか？ 公開はしません。」と確認し、その一件への明示承認がある時だけ`note-draft`へつなぎます。

### 画像制作

- `note-image`を使い、記事全文ではなく確定タイトル、読者、核となる場面、禁止事項等のbounded briefから制作します。
- 見出し画像はタイトル文字を画像生成と同時に含め、実寸と320×168pxの小表示を人の目で確認します。差し絵は利用者が希望した一案だけを扱います。
- asset registryへrevisionを保存し、QA結果と納品可能なpathを記事制作タスクへ返すところまで担当します。
- 標準の画像タスクは毎記事で再利用します。同時制作や長期化で必要な時だけ、利用者の承認後に追加の利用者向け画像タスクを作ります。画像工程が失敗しても完成済みの記事を巻き戻しません。

## 共有機能

- メモ、日記、気づき: どの役割からも`note-source-log`を使い、原文を保って同じworkspaceへ追記します。
- 文体プロフィール: `note-style-profile`を使い、本人が権利を持つ文章から書き方だけを抽出します。元本文や記事固有の事実はプロフィールへ保存しません。
- 構造的設定、移行、修復: `note-workspace-setup`へ戻ります。
- 必要なSkillが見つからない場合は導入状態を確認します。実行環境の能力不足や操作失敗がある時は、該当工程の状態と再開方法を示します。一記事だけを今すぐ作る用途では、利用可能な環境で`note Studio mini｜ROGNALIA`も選べます。

## 1タスク簡易運用

`task_topology.mode`が`compact_single`なら、同じタスク内で上記5役を切り替えます。正本、品質ゲート、画像QA、下書き承認は標準運用と同じです。構成変更はsetupで対象と承認を確認し、binding generationを上げてtaskの開始指示、ready、bindingを確認します。従来の`standard_four`に日記担当を無断追加せず、希望された時に`standard_five`への変更を案内します。

## セットアップへ戻る条件

通常の記事制作、メモ保存、企画相談、目標・頻度・休止の見直しでは初回セットアップをやり直しません。テーマ、読者、公開範囲、保存先、機能、task mode等の構造的設定変更、schema移行、validator異常の修復だけをセットアップで扱います。

## 安全と正本

- 利用者の目的と運用設定は`profile/`と`strategy/`、原文は`primary-log/`、再利用材料は`source-cards/`を正本にします。
- 架空の経験、感情、成果、数字、引用を作りません。
- 外部送信、クラウド同期、heartbeat作成、noteへの書き込みは、それぞれ別の承認境界に従います。定期実行の希望はlocalに保存しますが、現在状態はplatformから確認します。
- 指標は項目ごとに分け、取得できなかった値を`0`にしません。
"""


def render_codex_workspace_adapter() -> str:
    return """# note Workspace instructions

このworkspaceでnoteに関する依頼を扱う時は、最初に`STUDIO.md`を読んでください。通常運用の正本は`STUDIO.md`であり、このファイルはCodexがそれを見つけるためのadapterです。

- 利用者は自然な言葉で依頼します。Skill IDの指定を求めず、現在のタスクの役割は`strategy/role-task-plan.md`で確認します。
- 通常の記事制作、メモ保存、企画相談では初回セットアップをやり直しません。
- 構造的な設定変更、移行、修復が必要な時だけ`note-workspace-setup`へ戻ります。目標、頻度、休止の変更は承認後に`note-strategist`で扱います。
- 毎回`profile/standing-instructions.md`を読み、会話だけを永続的な正本にしません。
- 利用可能なSkillと権限の範囲で進め、外部操作の承認境界を守ります。
- `strategy/operating-settings.json`の定期実行設定は希望です。作成、変更、再実行、状態報告、重複判定の前にplatformから現在状態を読み戻し、確認できない時は`未確認`として重複作成を止めます。
"""


def planned_relative_paths(
    moment: datetime, *, include_start_here: bool = True
) -> list[str]:
    year = f"{moment.year:04d}"
    month = f"{moment.year:04d}-{moment.month:02d}.jsonl"
    paths = [
        "AGENTS.md",
        "README.md",
        "STUDIO.md",
        "workspace.json",
        "profile/creator-profile.md",
        "profile/style-profile.md",
        "profile/standing-instructions.md",
        "profile/standing-instructions.json",
        "profile/standing-instructions-history.jsonl",
        "strategy/strategy.md",
        "strategy/operating-settings.json",
        "strategy/role-task-plan.md",
        "strategy/role-task-bindings.jsonl",
        "strategy/change-history.jsonl",
        f"primary-log/{year}/{month}",
        "source-cards/cards.jsonl",
        "context-packs/registry.jsonl",
        "plans/weekly/",
        "articles/registry.jsonl",
        "articles/drafts/",
        "metrics/history.jsonl",
        "assets/",
    ]
    if include_start_here:
        paths.insert(2, "START_HERE.md")
    return paths


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(content.rstrip() + "\n")


def _write_json(path: Path, value: dict[str, Any]) -> None:
    _write_text(path, json.dumps(value, ensure_ascii=False, indent=2))


def build_workspace_tree(
    root: Path,
    config: dict[str, Any],
    workspace_id: str,
    created_at: str,
    moment: datetime,
) -> None:
    profile = config["profile"]
    operation = config["operation"]
    task_names = config["task_names"]
    year = f"{moment.year:04d}"
    month = f"{moment.year:04d}-{moment.month:02d}.jsonl"

    for relative in (
        "context-packs",
        "plans/weekly",
        "articles/drafts",
        "assets",
    ):
        (root / relative).mkdir(parents=True, exist_ok=False)

    _write_text(root / "AGENTS.md", render_codex_workspace_adapter())
    _write_text(root / "README.md", render_workspace_readme(workspace_id))
    _write_text(root / "START_HERE.md", render_start_here(task_names, operation))
    _write_text(root / "STUDIO.md", render_runtime_guide())
    _write_json(root / "workspace.json", build_manifest(workspace_id, created_at))
    _write_text(root / "profile/creator-profile.md", render_creator_profile(profile))
    _write_text(root / "profile/style-profile.md", render_style_profile(profile))
    _write_text(
        root / "profile/standing-instructions.md",
        render_standing_instructions(),
    )
    _write_json(
        root / "profile/standing-instructions.json",
        build_standing_instruction_state(workspace_id, created_at),
    )
    _write_text(root / "profile/standing-instructions-history.jsonl", "")
    _write_text(root / "strategy/strategy.md", render_strategy(profile, operation))
    _write_json(
        root / "strategy/operating-settings.json",
        build_operating_settings(config, workspace_id, created_at),
    )
    _write_text(
        root / "strategy/role-task-plan.md",
        render_role_task_plan(task_names, operation),
    )
    _write_text(root / "strategy/role-task-bindings.jsonl", "")
    _write_text(root / "strategy/change-history.jsonl", "")
    _write_text(root / "primary-log" / year / month, "")
    _write_text(root / "source-cards/cards.jsonl", "")
    _write_text(root / "context-packs/registry.jsonl", "")
    _write_text(root / "articles/registry.jsonl", "")
    _write_text(root / "metrics/history.jsonl", "")


def _read_json(path: Path, errors: list[str]) -> Optional[dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{path.name}: invalid JSON ({exc})")
        return None
    if not isinstance(value, dict):
        errors.append(f"{path.name}: top level must be an object")
        return None
    return value


def _validate_jsonl(path: Path, errors: list[str]) -> None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        errors.append(f"{path}: cannot read ({exc})")
        return
    for index, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"{path}: line {index} is invalid JSON ({exc.msg})")
            continue
        if not isinstance(value, dict):
            errors.append(f"{path}: line {index} must be an object")


def validate_workspace(root: Path) -> list[str]:
    """Return human-readable validation errors. An empty list means pass."""

    errors: list[str] = []
    if not root.exists():
        return ["workspace does not exist"]
    if not root.is_dir():
        return ["workspace path is not a directory"]
    if root.is_symlink():
        errors.append("workspace root must not be a symlink")

    manifest_path = root / "workspace.json"
    settings_path = root / "strategy/operating-settings.json"
    for path in (manifest_path, settings_path):
        if not path.is_file():
            errors.append(f"missing file: {path.relative_to(root)}")

    manifest = _read_json(manifest_path, errors) if manifest_path.is_file() else None
    settings = _read_json(settings_path, errors) if settings_path.is_file() else None
    task_names: Any = None
    topology: Any = None

    created_moment: Optional[datetime] = None
    if manifest is not None:
        if manifest.get("schema_version") != SCHEMA_VERSION:
            errors.append("workspace.json: unsupported schema_version")
        if manifest.get("product_id") != PRODUCT_ID:
            errors.append("workspace.json: product_id mismatch")
        if manifest.get("data_owner") != "user":
            errors.append("workspace.json: data_owner must be user")
        if manifest.get("runtime_guide") != "STUDIO.md":
            errors.append("workspace.json: runtime_guide must be STUDIO.md")
        if manifest.get("status") != "ready":
            errors.append("workspace.json: status must be ready")
        created_value = manifest.get("created_at")
        try:
            if not isinstance(created_value, str):
                raise SetupConfigError("created_at is missing")
            _, created_moment = parse_timestamp(created_value)
        except SetupConfigError:
            errors.append("workspace.json: created_at must be ISO 8601 with timezone")

    if settings is not None:
        if settings.get("schema_version") != SCHEMA_VERSION:
            errors.append("operating-settings.json: unsupported schema_version")
        if manifest and settings.get("workspace_id") != manifest.get("workspace_id"):
            errors.append("operating-settings.json: workspace_id mismatch")
        lifecycle = settings.get("lifecycle")
        if not isinstance(lifecycle, dict):
            errors.append("operating-settings.json: lifecycle must be an object")
        else:
            if lifecycle.get("phase") != "operation":
                errors.append("operating-settings.json: lifecycle.phase must be operation")
            if lifecycle.get("runtime_guide") != "STUDIO.md":
                errors.append("operating-settings.json: runtime_guide must be STUDIO.md")
            if lifecycle.get("setup_skill") != "note-workspace-setup":
                errors.append("operating-settings.json: setup_skill mismatch")
            if lifecycle.get("user_entry") != "natural_language":
                errors.append("operating-settings.json: user_entry must be natural_language")
        storage = settings.get("storage")
        if not isinstance(storage, dict) or storage.get("mode") != "local":
            errors.append("operating-settings.json: storage.mode must be local")
        else:
            cloud = storage.get("cloud_sync")
            if not isinstance(cloud, dict) or cloud.get("enabled") is not False:
                errors.append("operating-settings.json: cloud sync is not supported by this adapter")
        features = settings.get("features")
        if not isinstance(features, dict):
            errors.append("operating-settings.json: features must be an object")
        else:
            draft = features.get("note_draft_registration")
            metrics = features.get("metrics_tracking")
            if not isinstance(draft, dict):
                errors.append("operating-settings.json: missing note draft settings")
            else:
                if draft.get("approval_mode") != "per_article_after_final_assets":
                    errors.append("operating-settings.json: invalid draft approval mode")
                if draft.get("publish") is not False:
                    errors.append("operating-settings.json: publish must be false")
                if draft.get("overwrite_existing_draft") is not False:
                    errors.append("operating-settings.json: existing draft overwrite must be false")
            if not isinstance(metrics, dict) or metrics.get("unavailable_value") != "unavailable":
                errors.append("operating-settings.json: unavailable metrics must remain unavailable")
        cadence = settings.get("cadence")
        if not isinstance(cadence, dict):
            errors.append("operating-settings.json: cadence must be an object")
        else:
            if cadence.get("status") not in {"active", "paused"}:
                errors.append("operating-settings.json: cadence.status must be active or paused")
            for key in ("desired_frequency", "minimum_frequency"):
                if not isinstance(cadence.get(key), str) or not cadence.get(key, "").strip():
                    errors.append(f"operating-settings.json: cadence.{key} must be text")
        topology = settings.get("task_topology")
        if not isinstance(topology, dict):
            errors.append("operating-settings.json: task_topology must be an object")
        else:
            if topology.get("mode") not in TASK_MODES:
                errors.append("operating-settings.json: invalid task_topology.mode")
            generation = topology.get("binding_generation")
            if (
                isinstance(generation, bool)
                or not isinstance(generation, int)
                or generation < 1
            ):
                errors.append(
                    "operating-settings.json: binding_generation must be a positive integer"
                )
            if topology.get("shared_source_log") is not True:
                errors.append("operating-settings.json: source log must be shared")
            if topology.get("binding_registry") != "strategy/role-task-bindings.jsonl":
                errors.append("operating-settings.json: invalid binding registry")
            if topology.get("ready_message_required") is not True:
                errors.append("operating-settings.json: ready message must be required")
            if topology.get("extra_image_tasks") != "explicit_approval_only":
                errors.append("operating-settings.json: extra image tasks require approval")
        task_names = settings.get("task_names")
        required_names = TASK_NAME_ALLOWED if isinstance(topology, dict) and topology.get("mode") == "standard_five" else TASK_NAME_ALLOWED - {"diary"}
        if (not isinstance(task_names, dict)
                or not required_names.issubset(task_names)
                or set(task_names) - TASK_NAME_ALLOWED):
            errors.append("operating-settings.json: task_names do not match the role contract")
        elif any(
            not isinstance(value, str) or not value.strip()
            for value in task_names.values()
        ):
            errors.append("operating-settings.json: task names must be non-empty text")
        automation = settings.get("automation_preferences")
        if not isinstance(automation, dict):
            errors.append("operating-settings.json: automation_preferences must be an object")
        else:
            expected_roles = {"tracking": "tracker", "weekly_planning": "strategy"}
            for key, role in expected_roles.items():
                item = automation.get(key)
                if not isinstance(item, dict):
                    errors.append(f"operating-settings.json: missing automation {key}")
                    continue
                requested = item.get("requested")
                schedule = item.get("schedule")
                if not isinstance(requested, bool):
                    errors.append(f"operating-settings.json: {key}.requested must be boolean")
                if requested and (not isinstance(schedule, str) or not schedule.strip()):
                    errors.append(f"operating-settings.json: {key}.schedule is required")
                if requested is False and schedule is not None:
                    errors.append(f"operating-settings.json: {key}.schedule must be null")
                if item.get("target_role") != role:
                    errors.append(f"operating-settings.json: {key}.target_role mismatch")
            weekly = automation.get("weekly_planning")
            if isinstance(weekly, dict) and weekly.get("runs_after") != "tracking":
                errors.append("operating-settings.json: weekly planning must run after tracking")

    if created_moment is None:
        created_moment = datetime.now(timezone.utc)
    include_start_here = not (
        manifest is not None
        and manifest.get("generator_version") == "0.3.0-dev"
    )
    required_paths = planned_relative_paths(
        created_moment, include_start_here=include_start_here
    )
    for relative in required_paths:
        directory = relative.endswith("/")
        path = root / relative.rstrip("/")
        if directory and not path.is_dir():
            errors.append(f"missing directory: {relative}")
        elif not directory and not path.is_file():
            errors.append(f"missing file: {relative}")
        elif path.is_symlink():
            errors.append(f"required path must not be a symlink: {relative}")

    for relative in (
        "profile/standing-instructions-history.jsonl",
        "strategy/change-history.jsonl",
        "strategy/role-task-bindings.jsonl",
        "source-cards/cards.jsonl",
        "context-packs/registry.jsonl",
        "articles/registry.jsonl",
        "metrics/history.jsonl",
    ):
        path = root / relative
        if path.is_file():
            _validate_jsonl(path, errors)
    primary_root = root / "primary-log"
    if primary_root.is_dir():
        for path in sorted(primary_root.glob("*/*.jsonl")):
            _validate_jsonl(path, errors)

    style_path = root / "profile/style-profile.md"
    if style_path.is_file():
        style = style_path.read_text(encoding="utf-8")
        for heading in (
            "## 基本の語り口",
            "## 文のリズム",
            "## 導入",
            "## 見出しと構成",
            "## 具体性",
            "## 好む表現",
            "## 避ける表現",
            "## 記事ごとに選ぶこと",
            "## 絶対に作らないもの",
        ):
            if heading not in style:
                errors.append(f"profile/style-profile.md: missing heading {heading}")

    standing_path = root / "profile/standing-instructions.md"
    standing_state_path = root / "profile/standing-instructions.json"
    if standing_path.is_file():
        standing = standing_path.read_text(encoding="utf-8")
        for heading in ("## 現在の継続指示", "## 記録するときのルール"):
            if heading not in standing:
                errors.append(
                    f"profile/standing-instructions.md: missing heading {heading}"
                )
        if standing_state_path.is_file():
            standing_state = _read_json(standing_state_path, errors)
            if standing_state is not None:
                if standing_state.get("schema_version") != SCHEMA_VERSION:
                    errors.append(
                        "profile/standing-instructions.json: unsupported schema_version"
                    )
                if manifest and standing_state.get("workspace_id") != manifest.get(
                    "workspace_id"
                ):
                    errors.append(
                        "profile/standing-instructions.json: workspace_id mismatch"
                    )
                revision = standing_state.get("revision")
                if (
                    isinstance(revision, bool)
                    or not isinstance(revision, int)
                    or revision < 0
                ):
                    errors.append(
                        "profile/standing-instructions.json: revision must be non-negative"
                    )
                instructions = standing_state.get("instructions")
                normalized_instructions: list[dict[str, str]] = []
                if not isinstance(instructions, list):
                    errors.append(
                        "profile/standing-instructions.json: instructions must be an array"
                    )
                else:
                    ids: set[str] = set()
                    for index, item in enumerate(instructions):
                        if not isinstance(item, dict) or set(item) != {
                            "instruction_id",
                            "category",
                            "text",
                        }:
                            errors.append(
                                "profile/standing-instructions.json: invalid instruction "
                                + str(index)
                            )
                            continue
                        if any(
                            not isinstance(item.get(key), str)
                            or not item.get(key, "").strip()
                            for key in ("instruction_id", "category", "text")
                        ):
                            errors.append(
                                "profile/standing-instructions.json: instruction fields must be text"
                            )
                            continue
                        if item["instruction_id"] in ids:
                            errors.append(
                                "profile/standing-instructions.json: duplicate instruction_id"
                            )
                            continue
                        ids.add(item["instruction_id"])
                        normalized_instructions.append(item)
                    expected_standing = render_standing_instructions(
                        normalized_instructions
                    ).rstrip() + "\n"
                    if standing != expected_standing:
                        errors.append(
                            "profile/standing-instructions.md: does not match JSON state"
                        )

    runtime_guide_path = root / "STUDIO.md"
    if runtime_guide_path.is_file():
        runtime_guide = runtime_guide_path.read_text(encoding="utf-8")
        for required_text in (
            "通常運用へ引き継がれています",
            "利用者にSkill ID",
            "通常の記事制作、メモ保存、企画相談、目標・頻度・休止の見直しでは初回セットアップをやり直しません",
            "strategy/operating-settings.json",
            "profile/standing-instructions.md",
            "strategy_recommendation",
            "user_selection",
            "direction_source: user_request",
            "note-writer",
            "note-draft-quality",
            "note-image",
            "note-draft",
            "noteの下書き登録まで進めますか？ 公開はしません。",
            "品質チェック結果、点数、修正一覧、内部工程名を原稿へ付けません",
            "画像制作の完了報告とQA済みassetを受け取り",
        ):
            if required_text not in runtime_guide:
                errors.append(f"STUDIO.md: missing runtime contract {required_text}")
        if isinstance(topology, dict) and topology.get("mode") == "standard_five":
            for text in ("日記・体験ログ", "note-source-log"):
                if text not in runtime_guide:
                    errors.append(f"STUDIO.md: missing diary contract {text}")

    start_here_path = root / "START_HERE.md"
    if start_here_path.is_file():
        start_here = start_here_path.read_text(encoding="utf-8")
        legacy_guide = (
            isinstance(manifest, dict)
            and manifest.get("generator_version") in {"0.3.0-dev", "0.3.1-dev"}
        )
        status_guidance = (
            (
                "担当タスクの準備状況と、セットアップ時点での定期実行の状態は",
                "定期実行は、希望を記録しただけでは動きません",
                "後から確認できない時は「未確認」とし、重複作成しません",
            )
            if legacy_guide
            else (
                "この欄は選択した設定です",
                "担当タスクの準備状況と定期実行の対象・次回実行時刻は",
                "最新の状態は利用中のアプリから確認します",
                "確認できない場合は「未確認」と案内します",
            )
        )
        for required_text in ("30秒で分かる使い方",) + status_guidance:
            if required_text not in start_here:
                errors.append(
                    f"START_HERE.md: missing user guidance {required_text}"
                )
        mode = None
        if isinstance(settings, dict):
            topology = settings.get("task_topology")
            if isinstance(topology, dict):
                mode = topology.get("mode")
        if mode in {"standard_four", "standard_five"} and isinstance(task_names, dict):
            for key in PRIMARY_ROLES_BY_MODE[mode]:
                if task_names.get(key, "") not in start_here:
                    errors.append(
                        f"START_HERE.md: missing current task name {task_names[key]}"
                    )
            if "迷った時は、まず" not in start_here:
                errors.append("START_HERE.md: missing the default entry guidance")
            if "利用者が会話やファイルをコピー" not in start_here:
                errors.append("START_HERE.md: missing the shared workspace guidance")
            if "セットアップに使ったタスクは" not in start_here:
                errors.append("START_HERE.md: missing the setup task handoff guidance")
            expected_new_tasks = (
                "新しく増えるのは、計測、記事制作、画像制作、日記の4タスク"
                if mode == "standard_five"
                else "新しく増えるのは、計測、記事制作、画像制作の3タスク"
            )
            if expected_new_tasks not in start_here:
                errors.append("START_HERE.md: missing the new tasks guidance")
        elif mode == "compact_single" and isinstance(task_names, dict):
            if task_names["compact"] not in start_here:
                errors.append(
                    f"START_HERE.md: missing current task name {task_names['compact']}"
                )
            if "担当を選び分ける必要はありません" not in start_here:
                errors.append("START_HERE.md: missing compact mode guidance")

    adapter_path = root / "AGENTS.md"
    if adapter_path.is_file():
        adapter = adapter_path.read_text(encoding="utf-8")
        if "`STUDIO.md`" not in adapter:
            errors.append("AGENTS.md: must point to STUDIO.md")

    role_plan_path = root / "strategy/role-task-plan.md"
    if role_plan_path.is_file():
        role_plan = role_plan_path.read_text(encoding="utf-8")
        role_mode = None
        if isinstance(settings, dict):
            topology = settings.get("task_topology")
            if isinstance(topology, dict):
                role_mode = topology.get("mode")
        planned_names = (
            list(task_names.values())
            if isinstance(task_names, dict)
            else list(STANDARD_TASK_NAMES.values())
        )
        for required_text in planned_names + [
            "strategy/role-task-bindings.jsonl",
            "空のタスクを作っただけで完了にしない",
        ]:
            if required_text not in role_plan:
                errors.append(
                    f"strategy/role-task-plan.md: missing task contract {required_text}"
                )
        if role_mode in {"standard_four", "standard_five"}:
            for required_text in (
                "現在のセットアップタスク自身を最初に",
                "strategyを別タスクとして新規作成せず",
                "新しい役割タスクを一つも作らず停止",
            ):
                if required_text not in role_plan:
                    errors.append(
                        "strategy/role-task-plan.md: missing setup task reuse "
                        f"contract {required_text}"
                    )

    return errors
