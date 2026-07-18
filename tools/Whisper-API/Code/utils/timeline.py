def seconds_to_timestamp(seconds: float) -> str:
    total_ms = max(0, round(float(seconds) * 1000))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, milliseconds = divmod(remainder, 1_000)
    return f"{hours:02}:{minutes:02}:{secs:02}.{milliseconds:03}"


def build_timeline_text(segments: list) -> str:
    lines = []
    for seg in segments:
        lines.append(f"[{seg['start_time']} --> {seg['end_time']}]\n{seg.get('text', '').strip()}\n")
    return "\n".join(lines)
