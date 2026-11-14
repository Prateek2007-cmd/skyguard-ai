from datetime import datetime, timezone
from typing import Tuple, Dict, List

# A frozen value only counts when the identical readings span a meaningful
# interval. Upstream "current" values update slowly, so without a span guard
# a few polls inside one calm hour would look like a stuck sensor.
MIN_FLATLINE_SPAN_MINUTES = 30.0


def _parse_observed_at(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


class RuleChecker:
    """
    Evaluates instant physical limits and flatlines before passing to AI.
    """
    def __init__(self):
        self.temp_range = (-10.0, 55.0)    # Celsius
        self.press_range = (900.0, 1100.0) # hPa
        self.hum_range = (0.0, 100.0)      # %

    def check_reading_detailed(self, current: Dict, recent_history: List[Dict] = None) -> List[Dict]:
        """Per-rule results, in evaluation order. The first failing rule
        decides the flag; callers needing only the verdict use
        check_reading()."""
        temp = current.get('temperature')
        press = current.get('pressure')
        hum = current.get('humidity')
        results = []

        def _range_rule(name, value, bounds, unit):
            ok = value is not None and bounds[0] <= value <= bounds[1]
            return {
                "rule": name,
                "passed": ok,
                "detail": (
                    f"{name} {value}{unit} within {bounds}"
                    if ok else
                    f"{name} {value}{unit} out of valid range {bounds}"
                ),
            }

        results.append(_range_rule("Temperature", temp, self.temp_range, "°C"))
        results.append(_range_rule("Pressure", press, self.press_range, " hPa"))
        results.append(_range_rule("Humidity", hum, self.hum_range, "%"))

        # Frozen Value / Flatline Check — the LAST 4 distinct observations
        # plus the current reading must all be identical. (The original code
        # compared the whole history window, which meant a sensor that froze
        # 5 observations ago was never flagged; the documented intent was
        # always "4+ identical consecutive readings".) The identical values
        # must also span at least MIN_FLATLINE_SPAN_MINUTES, so a few polls
        # inside one calm hour do not look like a stuck sensor. History rows
        # without timestamps keep the legacy behaviour (flag on identical
        # values) so older callers are unaffected.
        flatline = {"rule": "Flatline", "passed": True,
                    "detail": "No frozen-sensor pattern."}
        if recent_history and len(recent_history) >= 4:
            window = recent_history[-4:]
            temps = [r['temperature'] for r in window] + [temp]
            if len(set(temps)) == 1:
                stamps = [
                    _parse_observed_at(r.get('observed_at')) for r in window
                ]
                stamps = [s for s in stamps if s is not None]
                span_ok = True
                if len(stamps) >= 2:
                    span_min = (max(stamps) - min(stamps)).total_seconds() / 60.0
                    span_ok = span_min >= MIN_FLATLINE_SPAN_MINUTES
                    flatline["detail"] = (
                        f"Identical values span only {span_min:.0f} min "
                        f"(needs {MIN_FLATLINE_SPAN_MINUTES:.0f}); not a frozen sensor."
                    )
                if span_ok:
                    flatline = {
                        "rule": "Flatline",
                        "passed": False,
                        "detail": f"Sensor flatline detected: Temperature frozen at {temp}°C",
                    }
        results.append(flatline)
        return results

    def check_reading(self, current: Dict[str, float], recent_history: List[Dict[str, float]] = None) -> Tuple[str, str]:
        for result in self.check_reading_detailed(current, recent_history):
            if not result["passed"]:
                return "FAULTY", result["detail"]
        return "GOOD", "All basic rule checks passed"