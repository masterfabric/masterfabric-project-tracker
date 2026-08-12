#!/usr/bin/env python3
"""Write WidgetDemoSeed-equivalent snapshot into App Support + App Group defaults for widget QA."""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

SUPPORT = Path.home() / "Library/Application Support/com.masterfabric.projectTracker"
# Signed builds also use the App Group container; mirror there when present.
GROUP = Path.home() / "Library/Group Containers/group.com.masterfabric.projectTracker/Library/Application Support/com.masterfabric.projectTracker"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> None:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = start - timedelta(days=1)
    today_pm = now.replace(hour=17, minute=0, second=0, microsecond=0)
    tomorrow = start + timedelta(days=1)
    next_week = start + timedelta(days=5)

    snapshot = {
        "todos": [
            {
                "id": "demo-todo-1",
                "userID": "demo-user",
                "title": "Ship widget checklist polish",
                "completed": False,
                "organizationID": None,
                "assignedToUserID": None,
                "dueAt": iso(yesterday),
                "createdAt": iso(now - timedelta(days=3)),
                "updatedAt": None,
            },
            {
                "id": "demo-todo-2",
                "userID": "demo-user",
                "title": "Review due-distribution bars",
                "completed": False,
                "dueAt": iso(today_pm),
                "createdAt": iso(now - timedelta(days=2)),
            },
            {
                "id": "demo-todo-3",
                "userID": "demo-user",
                "title": "Draft focus-timer notes",
                "completed": False,
                "dueAt": iso(next_week),
                "createdAt": iso(now - timedelta(days=1)),
            },
            {
                "id": "demo-todo-4",
                "userID": "demo-user",
                "title": "Archive old personal list",
                "completed": True,
                "dueAt": iso(yesterday),
                "createdAt": iso(now - timedelta(days=7)),
            },
        ],
        "projectTodos": [
            {
                "id": "demo-issue-1",
                "projectId": "demo-project",
                "title": "Pulse ring % label",
                "status": "OPEN",
                "dueAt": iso(today_pm),
            },
            {
                "id": "demo-issue-2",
                "projectId": "demo-project",
                "title": "Chat notification cards",
                "status": "OPEN",
                "dueAt": iso(tomorrow),
            },
            {
                "id": "demo-issue-3",
                "projectId": "demo-project",
                "title": "Quick Add intent dialog",
                "status": "OPEN",
                "dueAt": None,
            },
            {
                "id": "demo-issue-4",
                "projectId": "demo-project",
                "title": "App Group snapshot race",
                "status": "DONE",
                "dueAt": iso(yesterday),
            },
            {
                "id": "demo-issue-5",
                "projectId": "demo-project",
                "title": "Widget gallery install script",
                "status": "DONE",
                "dueAt": iso(yesterday),
            },
        ],
        "projectPulse": {
            "projectId": "demo-project",
            "projectName": "Core",
            "organizationName": "MasterFabric Demo",
            "openCount": 3,
            "doneCount": 2,
        },
        "recentMessages": [
            {
                "id": "demo-msg-3",
                "organizationID": "demo-org",
                "authorUserID": "demo-alex",
                "authorNickname": "Alex",
                "body": "Dashboard charts look good on Desktop Large.",
                "createdAt": iso(now - timedelta(seconds=120)),
            },
            {
                "id": "demo-msg-2",
                "organizationID": "demo-org",
                "authorUserID": "demo-sam",
                "authorNickname": "Sam",
                "body": "Pulse ring hit 71% — shipping notes ready.",
                "createdAt": iso(now - timedelta(seconds=900)),
            },
            {
                "id": "demo-msg-1",
                "organizationID": "demo-org",
                "authorUserID": "demo-jordan",
                "authorNickname": "Jordan",
                "body": "Reminder: pin Project Tracker Dashboard after install-debug.",
                "createdAt": iso(now - timedelta(hours=1)),
            },
        ],
        "chatOrganizationName": "MasterFabric Demo",
        "lastReadMessageId": "demo-msg-1",
        "taskScope": "personal",
        "updatedAt": iso(now),
    }

    timer = {
        "durationSeconds": 1500,
        "remainingSeconds": 1080,
        "isRunning": True,
        "endsAt": iso(now + timedelta(seconds=1080)),
        "selectedFocusTaskId": "personal:demo-todo-2",
        "selectedFocusTaskTitle": "Review due-distribution bars",
        "selectedFocusTaskScope": "personal",
    }

    payload = json.dumps(snapshot, indent=2)
    timer_payload = json.dumps(timer, indent=2)
    written = []
    for root in (SUPPORT, GROUP):
        root.mkdir(parents=True, exist_ok=True)
        # AppGroupStore.fileURL appends ".json" for every key (including string flags).
        (root / "widgetSnapshot.json").write_text(payload)
        (root / "focusTimer.json").write_text(timer_payload)
        (root / "demoSeedActive.json").write_text("1")
        (root / "selectedOrganizationId.json").write_text("demo-org")
        (root / "selectedProjectId.json").write_text("demo-project")
        (root / "taskScope.json").write_text("personal")
        written.append(str(root))

    print("PASS wrote demo widget snapshot")
    for w in written:
        print(" ", w)
    print("Then: WidgetCenter.reload — Settings → Load demo data, or relaunch after install-debug.sh")
    print("Expect: 3 personal + 3 project open; pulse 3 open / 2 done (~60%); chat unread 2; focus ~18:00")


if __name__ == "__main__":
    main()
