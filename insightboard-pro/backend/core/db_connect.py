"""Work around IPv6-only Supabase direct hosts on Windows (psycopg2 DNS failures)."""

from __future__ import annotations

import re
import socket
import subprocess
import sys
from urllib.parse import urlparse, urlunparse


_IPV4_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")


def _resolve_host_address(hostname: str, port: int) -> str | None:
    """Return a connectable IP for hostname, preferring IPv4 when available."""
    try:
        infos = socket.getaddrinfo(
            hostname,
            port,
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )
    except socket.gaierror:
        infos = []

    for family in (socket.AF_INET, socket.AF_INET6):
        for info in infos:
            if info[0] == family:
                return info[4][0]

    return _resolve_via_nslookup(hostname)


def _resolve_via_nslookup(hostname: str) -> str | None:
    """
    Windows often resolves db.*.supabase.co via nslookup (IPv6) while
    getaddrinfo/psycopg2 report 'No such host is known'.
    """
    try:
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        output = subprocess.check_output(
            ["nslookup", hostname],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=15,
            creationflags=flags,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    ipv4: list[str] = []
    ipv6: list[str] = []
    host_marker = hostname.lower()
    in_answer = False
    for line in output.splitlines():
        lower = line.strip().lower()
        if lower.startswith("name:"):
            in_answer = host_marker in lower
            continue
        if not in_answer or not lower.startswith("address"):
            continue
        _, _, value = line.partition(":")
        value = value.strip()
        if not value:
            continue
        if _IPV4_RE.match(value):
            ipv4.append(value)
        elif ":" in value:
            ipv6.append(value)

    if ipv4:
        return ipv4[0]
    return None


def get_sync_connect_args(database_url: str) -> dict[str, str]:
    """
    psycopg2/libpq: set hostaddr so TLS still uses hostname from the URL (SNI).
    """
    parsed = urlparse(database_url)
    hostname = parsed.hostname
    if not hostname or hostname in {"localhost", "127.0.0.1", "postgres"}:
        return {}

    port = parsed.port or 5432
    address = _resolve_host_address(hostname, port)
    if not address:
        return {}
    return {"hostaddr": address}


def get_async_connect_args(database_url: str) -> dict[str, str | int]:
    """asyncpg: connect by resolved IP; preserve TLS hostname when possible."""
    parsed = urlparse(database_url)
    hostname = parsed.hostname
    if not hostname or hostname in {"localhost", "127.0.0.1", "postgres"}:
        return {}

    port = parsed.port or 5432
    address = _resolve_host_address(hostname, port)
    if not address:
        return {}

    return {"host": address, "port": port}


def rewrite_database_host(database_url: str, new_host: str) -> str:
    """Replace hostname in a SQLAlchemy database URL."""
    parsed = urlparse(database_url)
    if not parsed.hostname:
        return database_url

    userinfo = ""
    if parsed.username:
        userinfo = parsed.username
        if parsed.password is not None:
            userinfo += f":{parsed.password}"
        userinfo += "@"

    port = parsed.port or 5432
    netloc = f"{userinfo}{new_host}:{port}"
    return urlunparse(parsed._replace(netloc=netloc))
