"""UN SDG V5 client. Standard library only; complete results or explicit failure."""
from __future__ import annotations

import hashlib
import http.client
import json
import math
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE_URL = "https://unstats.un.org/sdgs/UNSDGAPIV5/v1/sdg"
TRANSIENT = {429, 500, 502, 503, 504}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


class SDGError(Exception):
    def __init__(self, code, message, **details):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details

    def as_dict(self):
        return {"status": "error", "error": {"code": self.code, "message": self.message, "details": self.details}}


def validate_url(url):
    try:
        p = urllib.parse.urlsplit(url)
        valid = (p.scheme == "https" and p.hostname == "unstats.un.org" and
                 p.port in (None, 443) and not p.username and not p.password and
                 p.path.startswith("/sdgs/UNSDGAPIV5/v1/sdg/") and not p.fragment and
                 ".." not in urllib.parse.unquote(p.path).split("/"))
    except ValueError:
        valid = False
    if not valid:
        raise SDGError("unsafe_api_link", "API URL is outside the permitted UN SDG endpoint.")
    return url


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def as_year(value):
    try:
        number = float(value)
        return int(number) if math.isfinite(number) and -2147483647 <= number <= 2147483647 else None
    except (TypeError, ValueError, OverflowError):
        return None


class SDGClient:
    def __init__(self, *, timeout=45, retries=3, page_size=1000, max_pages=10000,
                 max_rows=1000000, max_bytes=500000000, transport=None, sleep=time.sleep):
        if (not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or
                not math.isfinite(timeout) or timeout <= 0 or
                any(type(x) is not int or x <= 0 for x in (retries, page_size, max_pages, max_rows, max_bytes)) or
                page_size > 10000):
            raise SDGError("invalid_query", "Use positive client limits and page_size <= 10000.")
        self.timeout, self.retries, self.page_size = timeout, retries, page_size
        self.max_pages, self.max_rows, self.max_bytes = max_pages, max_rows, max_bytes
        self.transport, self.sleep = transport, sleep
        self.trace, self._cache = [], {}
        self._opener = urllib.request.build_opener(_CheckedRedirect())

    def url(self, path, params=()):
        url = BASE_URL + "/" + path.lstrip("/")
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)
        return validate_url(url)

    def request(self, path, params=()):
        url = self.url(path, params)
        for attempt in range(1, self.retries + 1):
            try:
                if self.transport:
                    body = self.transport(url)
                    content = json.dumps(body, ensure_ascii=False).encode("utf-8")
                else:
                    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "DSIR-SDG-Skill/0.1.0"})
                    with self._opener.open(req, timeout=self.timeout) as response:
                        validate_url(response.geturl())
                        content = response.read(min(self.max_bytes, 50000000) + 1)
                    body = json.loads(content.decode("utf-8-sig"))
                if len(content) > min(self.max_bytes, 50000000):
                    raise SDGError("response_limit", "API response exceeded the byte limit.", url=url)
                self.trace.append({"url": url, "retrieved_at": utc_now(), "attempt": attempt,
                                   "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
                return body
            except urllib.error.HTTPError as exc:
                if exc.code not in TRANSIENT or attempt == self.retries:
                    raise SDGError("un_api_request_failed", "UN SDG API request failed; this is not evidence of absent data.",
                                   url=url, http_status=exc.code, attempts=attempt) from exc
                retry_after = exc.headers.get("Retry-After", "") if exc.headers else ""
                delay = min(int(retry_after), 30) if retry_after.isdigit() else min(2 ** attempt, 30)
            except (ValueError, UnicodeError) as exc:
                if attempt == self.retries:
                    raise SDGError("invalid_response", "UN SDG API returned malformed JSON.", url=url) from exc
                delay = min(2 ** attempt, 30)
            except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, http.client.HTTPException, OSError) as exc:
                if attempt == self.retries:
                    raise SDGError("un_api_request_failed", "UN SDG API could not be reached; check script network access.",
                                   url=url, attempts=attempt, reason=str(exc)) from exc
                delay = min(2 ** attempt, 30)
            self.sleep(delay)

    def catalogue(self, kind):
        if kind not in self._cache:
            body = self.request(kind + "/List")
            key = "geoAreaCode" if kind == "GeoArea" else "code"
            if not isinstance(body, list) or not body or any(not isinstance(r, dict) or key not in r for r in body):
                raise SDGError("invalid_response", "UN SDG catalogue has an unexpected structure.", catalogue=kind)
            self._cache[kind] = body
        return self._cache[kind]

    def indicators(self):
        return self.catalogue("Indicator")

    def series(self):
        return self.catalogue("Series")

    def areas(self):
        return self.catalogue("GeoArea")

    def indicator(self, code):
        if not isinstance(code, str):
            raise SDGError("invalid_query", "Indicator must be a catalogue code string.")
        found = next((r for r in self.indicators() if r["code"] == code), None)
        if found is None:
            raise SDGError("indicator_not_found", "Indicator is absent from the current UN SDG catalogue.", indicator=code)
        return found

    def indicator_series(self, code):
        self.indicator(code)
        return [r for r in self.series() if code in r.get("indicator", [])]

    def _pages(self, indicator, areas=None, *, probe=False):
        params = [("indicator", indicator), ("pageSize", 1 if probe else self.page_size)]
        params += [("areaCode", a) for a in (areas or [])]
        rows, metadata, signatures = [], {"dimensions": [], "attributes": []}, set()
        expected = None
        byte_start = len(self.trace)
        for page in range(1, self.max_pages + 1):
            body = self.request("Indicator/Data", params + [("page", page)])
            if not isinstance(body, dict) or not isinstance(body.get("data"), list):
                raise SDGError("invalid_response", "UN SDG response is missing its data array.")
            total, pages, number = (body.get(k) for k in ("totalElements", "totalPages", "pageNumber"))
            if any(type(n) is not int or n < 0 for n in (total, pages, number)) or number != page:
                raise SDGError("incomplete_data", "UN SDG pagination counters are missing or invalid.")
            if total > 0 and pages == 0 or total == 0 and pages > 1:
                raise SDGError("incomplete_data", "UN SDG page and row counts contradict one another.")
            if expected is not None and expected != (total, pages):
                raise SDGError("incomplete_data", "UN SDG counts changed between pages; retry the query.")
            expected = (total, pages)
            batch = body["data"]
            if any(not isinstance(r, dict) for r in batch):
                raise SDGError("invalid_response", "UN SDG data contains non-record entries.")
            if not probe and (total > self.max_rows or pages > self.max_pages):
                raise SDGError("incomplete_data", "Query exceeds configured limits; narrow the area scope or raise limits.")
            if sum(t["bytes"] for t in self.trace[byte_start:]) > self.max_bytes:
                raise SDGError("incomplete_data", "Query exceeds the byte limit.")
            # Validate filters that the API is known to silently ignore if encoded incorrectly.
            for row in batch:
                ids = row.get("indicator", [])
                ids = [ids] if isinstance(ids, str) else ids
                if not isinstance(ids, list) or indicator not in ids:
                    raise SDGError("invalid_response", "API returned observations outside the requested indicator.")
                if areas and str(row.get("geoAreaCode")) not in areas:
                    raise SDGError("invalid_response", "API returned observations outside the requested areas.")
            if batch:
                signature = hashlib.sha256(json.dumps(batch, sort_keys=True).encode()).hexdigest()
                if signature in signatures:
                    raise SDGError("incomplete_data", "API repeated a page; complete data cannot be established.")
                signatures.add(signature)
            if probe:
                if bool(total) != bool(batch):
                    raise SDGError("incomplete_data", "Probe count and data disagree.")
                return {"total": total, "records": batch}
            rows.extend(batch)
            if len(rows) > self.max_rows:
                raise SDGError("incomplete_data", "Row limit exceeded.")
            for field in metadata:
                items = body.get(field, [])
                if not isinstance(items, list):
                    raise SDGError("invalid_response", "Dimension metadata must be an array.")
                for item in items:
                    if item not in metadata[field]:
                        metadata[field].append(item)
            if page >= pages:
                if len(rows) != total:
                    raise SDGError("incomplete_data", "Fetched row count does not equal the declared total.", fetched=len(rows), expected=total)
                return {"records": rows, "total": total, "pages": page, "metadata": metadata}
            if not batch:
                raise SDGError("incomplete_data", "An intermediate page is empty.")
        raise SDGError("incomplete_data", "Page limit reached.")

    def get_sdg_data(self, indicator, locations=None, year_from=None, year_to=None,
                     series=None, dimensions=None, attributes=None):
        for y in (year_from, year_to):
            if y is not None and (type(y) is not int or y < 0 or y > 9999):
                raise SDGError("invalid_query", "Years must be integers between 0 and 9999.")
        if year_from is not None and year_to is not None and year_from > year_to:
            raise SDGError("invalid_query", "year_from must not exceed year_to.")
        selected = self.indicator(indicator)
        if locations is not None:
            if not isinstance(locations, list) or not locations or any(not isinstance(v, str) or not v.isdigit() for v in locations):
                raise SDGError("invalid_query", "locations must be a nonempty list of resolved numeric UN area codes.")
            locations = list(dict.fromkeys(str(int(v)) for v in locations))
            known = {str(int(r["geoAreaCode"])) for r in self.areas()}
            if set(locations) - known:
                raise SDGError("location_not_found", "Area code is absent from the UN catalogue.")
        series = [series] if isinstance(series, str) else series
        known_series = self.indicator_series(indicator)
        if series is not None and (not isinstance(series, list) or not series or any(s not in {r['code'] for r in known_series} for s in series)):
            raise SDGError("series_not_found", "Series is not linked to this indicator in the current catalogue.", indicator=indicator)
        filters = {"dimensions": {} if dimensions is None else dimensions,
                   "attributes": {} if attributes is None else attributes}
        for field, mapping in filters.items():
            if not isinstance(mapping, dict) or any(not isinstance(k, str) or not k or not isinstance(v, (str, list)) or not v or
                                                   isinstance(v, list) and any(not isinstance(x, str) or not x for x in v)
                                                   for k, v in mapping.items()):
                raise SDGError("invalid_query", "Dimension/attribute filters must map names to codes or nonempty lists of codes.", field=field)
        result = self._pages(indicator, locations)
        rows = result["records"]
        for field, mapping in filters.items():
            available = {m.get("id") for m in result["metadata"][field] if isinstance(m, dict)}
            available |= {k for r in rows for k in (r.get(field) or {})}
            if rows and set(mapping) - available:
                raise SDGError("invalid_filter", "Unknown dimension/attribute name.", field=field, available=sorted(available))
        filtered = []
        for row in rows:
            year = as_year(row.get("timePeriodStart"))
            if (year_from is not None or year_to is not None) and year is None:
                if "timePeriodStart" not in row:
                    raise SDGError("invalid_response", "Cannot apply year filter: timePeriodStart is missing.")
                continue
            if year_from is not None and year < year_from or year_to is not None and year > year_to:
                continue
            if series and row.get("series") not in series:
                continue
            if any((row.get(field) or {}).get(key) not in ([val] if isinstance(val, str) else val)
                   for field, mapping in filters.items() for key, val in mapping.items()):
                continue
            filtered.append(row)
        probe = None
        if not rows and locations:
            probe = self._pages(indicator, probe=True)
        status = ("ok" if filtered else "filters_no_data" if rows or probe and probe["total"] else "indicator_no_data")
        return {"status": status, "indicator": selected, "series_catalogue": known_series,
                "query": {"indicator": indicator, "locations": locations, "year_from": year_from,
                          "year_to": year_to, "series": series, **filters},
                "records": filtered, "metadata": result["metadata"],
                "retrieved_row_count": len(rows), "pages": result["pages"],
                "baseline_probe": {"global_indicator_rows": probe["total"]} if probe else None}
