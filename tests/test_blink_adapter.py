"""Tests for the Blink adapter — no network calls, blinkpy may not be installed."""

from __future__ import annotations

import pytest

from petmonitor.blink.adapter import (
    BlinkAdapter,
    BlinkAuthError,
    BlinkError,
)


def test_missing_credentials_raises() -> None:
    with pytest.raises(BlinkAuthError, match="credentials are missing"):
        BlinkAdapter(username="", password="")


def test_missing_username_raises() -> None:
    with pytest.raises(BlinkAuthError):
        BlinkAdapter(username="", password="secret")


def test_missing_password_raises() -> None:
    with pytest.raises(BlinkAuthError):
        BlinkAdapter(username="user@example.com", password="")


def test_requires_connected_without_context() -> None:
    adapter = BlinkAdapter(username="u@example.com", password="pass")
    with pytest.raises(BlinkError, match="Not connected"):
        adapter._require_connected()


def test_from_env_missing_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BLINK_USERNAME", raising=False)
    monkeypatch.delenv("BLINK_PASSWORD", raising=False)
    with pytest.raises(BlinkAuthError):
        BlinkAdapter.from_env()


def test_from_env_with_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BLINK_USERNAME", "user@example.com")
    monkeypatch.setenv("BLINK_PASSWORD", "secret")
    adapter = BlinkAdapter.from_env()
    assert adapter._username == "user@example.com"
    # Password is stored but must not be logged — verify no easy leak.
    repr_str = repr(adapter)
    assert "secret" not in repr_str
