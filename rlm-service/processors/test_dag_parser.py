"""
Tests for DAG Parser

Verifies backward traversal, message filtering, and content extraction
against known ChatGPT export structures.
"""

import pytest
from .dag_parser import extract_active_path, is_visible_message, extract_content


# ---------------------------------------------------------------------------
# Fixtures: realistic ChatGPT export conversation structures
# ---------------------------------------------------------------------------


def _make_node(node_id, parent, children, role="user", content_parts=None, create_time=0, metadata=None):
    """Helper to build a mapping node with message."""
    msg = None
    if role is not None:
        msg = {
            "author": {"role": role},
            "content": {"parts": content_parts or [""]},
            "create_time": create_time,
            "metadata": metadata or {},
        }
    return {
        "id": node_id,
        "message": msg,
        "parent": parent,
        "children": children,
    }


# ---------------------------------------------------------------------------
# Tests for extract_active_path
# ---------------------------------------------------------------------------


class TestExtractActivePath:
    """Tests for backward DAG traversal."""

    def test_branching_conversation_returns_active_branch(self):
        """Conversation with edits/regenerations: only active branch returned."""
        # Structure:
        # root -> user_msg -> assistant_v1 (dead branch)
        #                  -> assistant_v2 -> user_followup   <-- active path
        conversation = {
            "id": "conv-branch",
            "title": "Branching Test",
            "current_node": "node-followup",
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-user"], role=None),
                "node-user": _make_node("node-user", "node-root", ["node-v1", "node-v2"],
                                        role="user", content_parts=["Hello"], create_time=1),
                "node-v1": _make_node("node-v1", "node-user", [],
                                      role="assistant", content_parts=["Old response"], create_time=2),
                "node-v2": _make_node("node-v2", "node-user", ["node-followup"],
                                      role="assistant", content_parts=["New response"], create_time=3),
                "node-followup": _make_node("node-followup", "node-v2", [],
                                            role="user", content_parts=["Thanks"], create_time=4),
            },
        }

        result = extract_active_path(conversation)

        # Should have 3 messages: user, assistant_v2, user_followup
        assert len(result) == 3
        assert result[0]["content"] == "Hello"
        assert result[0]["role"] == "user"
        assert result[1]["content"] == "New response"
        assert result[1]["role"] == "assistant"
        assert result[2]["content"] == "Thanks"
        assert result[2]["role"] == "user"

        # Should NOT include the dead branch (Old response)
        contents = [m["content"] for m in result]
        assert "Old response" not in contents

    def test_linear_conversation_returns_all_messages(self):
        """Linear conversation (no branches): all messages in order."""
        conversation = {
            "id": "conv-linear",
            "title": "Linear Test",
            "current_node": "node-3",
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-1"], role=None),
                "node-1": _make_node("node-1", "node-root", ["node-2"],
                                     role="user", content_parts=["Question"], create_time=1),
                "node-2": _make_node("node-2", "node-1", ["node-3"],
                                     role="assistant", content_parts=["Answer"], create_time=2),
                "node-3": _make_node("node-3", "node-2", [],
                                     role="user", content_parts=["Follow up"], create_time=3),
            },
        }

        result = extract_active_path(conversation)

        assert len(result) == 3
        assert result[0]["content"] == "Question"
        assert result[1]["content"] == "Answer"
        assert result[2]["content"] == "Follow up"

    def test_missing_current_node_uses_fallback(self, capsys):
        """Missing current_node: fallback root traversal with warning."""
        conversation = {
            "id": "conv-no-current",
            "title": "No Current Node",
            # No current_node field
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-1"], role=None),
                "node-1": _make_node("node-1", "node-root", ["node-2"],
                                     role="user", content_parts=["Hello fallback"], create_time=1),
                "node-2": _make_node("node-2", "node-1", [],
                                     role="assistant", content_parts=["Fallback response"], create_time=2),
            },
        }

        result = extract_active_path(conversation)

        assert len(result) >= 1  # Should produce some messages
        captured = capsys.readouterr()
        assert "WARNING" in captured.out
        assert "fallback" in captured.out.lower()

    def test_pre_parsed_format_passthrough(self):
        """Pre-parsed format with messages key and no mapping: passthrough."""
        messages = [
            {"role": "user", "content": "Hi", "create_time": 1},
            {"role": "assistant", "content": "Hello!", "create_time": 2},
        ]
        conversation = {
            "id": "conv-preparsed",
            "title": "Pre-parsed",
            "messages": messages,
        }

        result = extract_active_path(conversation)

        assert result is messages  # Should return the same list
        assert len(result) == 2

    def test_filters_tool_messages_from_active_path(self):
        """Tool messages in active path should be filtered out."""
        conversation = {
            "id": "conv-tools",
            "title": "Tool Test",
            "current_node": "node-3",
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-1"], role=None),
                "node-1": _make_node("node-1", "node-root", ["node-2"],
                                     role="user", content_parts=["Draw me a cat"], create_time=1),
                "node-2": _make_node("node-2", "node-1", ["node-3"],
                                     role="tool", content_parts=["dalle generation result"], create_time=2),
                "node-3": _make_node("node-3", "node-2", [],
                                     role="assistant", content_parts=["Here is your cat"], create_time=3),
            },
        }

        result = extract_active_path(conversation)

        assert len(result) == 2
        roles = [m["role"] for m in result]
        assert "tool" not in roles

    def test_extracts_multipart_content(self):
        """Messages with multiple content parts should capture all text."""
        conversation = {
            "id": "conv-multipart",
            "title": "Multipart Test",
            "current_node": "node-1",
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-1"], role=None),
                "node-1": _make_node("node-1", "node-root", [],
                                     role="user", content_parts=["Part one", "Part two"], create_time=1),
            },
        }

        result = extract_active_path(conversation)

        assert len(result) == 1
        assert "Part one" in result[0]["content"]
        assert "Part two" in result[0]["content"]

    def test_empty_mapping_returns_empty(self):
        """No mapping and no messages returns empty list."""
        conversation = {"id": "conv-empty", "title": "Empty"}
        result = extract_active_path(conversation)
        assert result == []


# ---------------------------------------------------------------------------
# Tests for is_visible_message
# ---------------------------------------------------------------------------


class TestIsVisibleMessage:
    """Tests for message visibility filtering."""

    def test_user_message_visible(self):
        msg = {"author": {"role": "user"}, "metadata": {}}
        assert is_visible_message(msg) is True

    def test_assistant_message_visible(self):
        msg = {"author": {"role": "assistant"}, "metadata": {}}
        assert is_visible_message(msg) is True

    def test_tool_message_hidden(self):
        msg = {"author": {"role": "tool"}, "metadata": {}}
        assert is_visible_message(msg) is False

    def test_system_message_hidden(self):
        msg = {"author": {"role": "system"}, "metadata": {}}
        assert is_visible_message(msg) is False

    def test_system_message_with_user_flag_visible(self):
        msg = {
            "author": {"role": "system"},
            "metadata": {"is_user_system_message": True},
        }
        assert is_visible_message(msg) is True

    def test_unknown_role_hidden(self):
        msg = {"author": {"role": "browsing"}, "metadata": {}}
        assert is_visible_message(msg) is False

    def test_missing_author_hidden(self):
        msg = {"metadata": {}}
        assert is_visible_message(msg) is False


# ---------------------------------------------------------------------------
# Tests for extract_content
# ---------------------------------------------------------------------------


class TestExtractContent:
    """Tests for polymorphic content.parts extraction."""

    def test_single_string_part(self):
        assert extract_content({"parts": ["hello"]}) == "hello"

    def test_multiple_string_parts(self):
        assert extract_content({"parts": ["hello", "world"]}) == "hello\nworld"

    def test_dict_part_with_text(self):
        assert extract_content({"parts": [{"text": "hello"}]}) == "hello"

    def test_mixed_parts_string_and_dict(self):
        parts = ["text", {"asset_pointer": "img"}, {"text": "more"}]
        result = extract_content({"parts": parts})
        assert result == "text\nmore"

    def test_direct_text_field(self):
        assert extract_content({"text": "hello"}) == "hello"

    def test_none_input(self):
        assert extract_content(None) == ""

    def test_empty_parts(self):
        assert extract_content({"parts": []}) == ""

    def test_empty_dict(self):
        assert extract_content({}) == ""

    def test_string_content_data(self):
        """Some formats have content as a plain string."""
        assert extract_content("hello direct") == "hello direct"

    def test_whitespace_stripped(self):
        assert extract_content({"parts": ["  spaced  "]}) == "spaced"
