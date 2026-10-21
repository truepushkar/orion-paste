"""A small in-process rate limiter.

Stow has no accounts, so the only identity available is the client address.
This is deliberately simple: a sliding window of timestamps per key, held in
memory, with a cap on how many keys are tracked so a flood of distinct
addresses cannot grow the process without bound.

It is honest about its limits: it is per-process, so running several workers
multiplies the effective quota. That is fine for the job it does, which is
stopping one client from hammering a paste box, not metering a paid product.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 10_000) -> None:
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Record a hit and report whether it is allowed.

        Returns (allowed, retry_after_seconds). A refused call still counts,
        so a client that ignores the refusal keeps being refused.
        """
        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            if len(self._hits) > self.max_keys:
                self._evict(cutoff)

            bucket = self._hits.get(key)
            if bucket is None:
                bucket = deque()
                self._hits[key] = bucket

            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            bucket.append(now)

            if len(bucket) > self.limit:
                oldest = bucket[0]
                retry_after = max(1, int(self.window - (now - oldest)) + 1)
                return False, retry_after

            return True, 0

    def _evict(self, cutoff: float) -> None:
        """Drop keys whose whole window has passed. Called under the lock."""
        stale = [
            key
            for key, bucket in self._hits.items()
            if not bucket or bucket[-1] < cutoff
        ]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
