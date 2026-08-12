#!/usr/bin/env python3
"""Smoke-test dashboard APIs: create todo + post org chat (same paths as mf-macos)."""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

CREDS = Path("/tmp/mf-macos-e2e-creds.json")
GQL = "http://127.0.0.1:8080/graphql"


def load_env_api_key() -> tuple[str, str]:
    env = Path("/Users/yurtaslanmac/Projects/masterfabric-project-tracker/local.env")
    bundle, key = "com.masterfabric.monoExpo", ""
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_MF_BUNDLE_ID="):
                bundle = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("EXPO_PUBLIC_MF_APP_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    return bundle, key


def gql(query: str, variables: dict | None = None, token: str | None = None) -> dict:
    bundle, key = load_env_api_key()
    headers = {"Content-Type": "application/json", "X-Bundle-ID": bundle}
    if key:
        headers["X-API-Key"] = key
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body: dict = {"query": query}
    if variables:
        body["variables"] = variables
    req = urllib.request.Request(GQL, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    if not CREDS.exists():
        # register disposable user
        email = f"dash.e2e.{int(time.time())}@example.com"
        password = "MacE2E-Test-Pass-123!"
        reg = gql(
            """mutation($input:RegisterInput!){register(input:$input){accessToken refreshToken user{id email}}}""",
            {"input": {"email": email, "password": password, "displayName": "Dash E2E"}},
        )
        if reg.get("errors"):
            raise SystemExit(f"register failed: {reg['errors']}")
        payload = reg["data"]["register"]
        CREDS.write_text(
            json.dumps(
                {
                    "email": email,
                    "password": password,
                    "accessToken": payload["accessToken"],
                    "refreshToken": payload["refreshToken"],
                    "userId": payload["user"]["id"],
                    "bundleId": load_env_api_key()[0],
                    "apiKey": load_env_api_key()[1],
                }
            )
        )
        print("PASS register", email)
    else:
        print("PASS reuse creds", json.loads(CREDS.read_text())["email"])

    c = json.loads(CREDS.read_text())
    login = gql(
        """mutation($input:LoginInput!){login(input:$input){accessToken user{email}}}""",
        {"input": {"email": c["email"], "password": c["password"]}},
    )
    if login.get("errors"):
        raise SystemExit(f"login failed: {login['errors']}")
    token = login["data"]["login"]["accessToken"]
    print("PASS login")

    title = f"dashboard-todo-{int(time.time())}"
    created = gql(
        """mutation($input:CreateTodoInput!){createTodo(input:$input){id title completed}}""",
        {"input": {"title": title, "completed": False}},
        token=token,
    )
    if created.get("errors"):
        # dueAt-less servers still accept create without selecting dueAt
        raise SystemExit(f"createTodo failed: {created['errors']}")
    print("PASS createTodo", created["data"]["createTodo"]["title"])

    orgs = gql("{ myOrganizations { id name } }", token=token)
    if orgs.get("errors"):
        raise SystemExit(f"orgs failed: {orgs['errors']}")
    org_list = orgs["data"]["myOrganizations"]
    print("PASS orgs", len(org_list))
    if not org_list:
        # create org so chat can be tested
        created_org = gql(
            """mutation($input:CreateOrganizationInput!){createOrganization(input:$input){id name}}""",
            {"input": {"name": f"Dash Org {int(time.time())}"}},
            token=token,
        )
        if created_org.get("errors"):
            raise SystemExit(f"createOrg failed: {created_org['errors']}")
        org_id = created_org["data"]["createOrganization"]["id"]
        print("PASS createOrganization", org_id)
    else:
        org_id = org_list[0]["id"]

    body = f"dashboard-chat-{int(time.time())}"
    posted = gql(
        """mutation($organizationId:UUID!,$body:String!){postOrganizationMessage(organizationId:$organizationId,body:$body){id body authorNickname}}""",
        {"organizationId": org_id, "body": body},
        token=token,
    )
    if posted.get("errors"):
        raise SystemExit(f"chat failed: {posted['errors']}")
    print("PASS postOrganizationMessage", posted["data"]["postOrganizationMessage"]["body"])

    msgs = gql(
        """query($organizationId:UUID!){organizationMessages(organizationId:$organizationId,limit:5){id body}}""",
        {"organizationId": org_id},
        token=token,
    )
    titles = [m["body"] for m in msgs.get("data", {}).get("organizationMessages", [])]
    assert body in titles, titles
    print("PASS organizationMessages contains chat")
    print("ALL DASHBOARD API CHECKS PASSED")


if __name__ == "__main__":
    main()
