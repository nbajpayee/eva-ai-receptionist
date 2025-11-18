"""
Load testing configuration using Locust.

Run with: locust --headless --users 50 --spawn-rate 10 --run-time 5m
"""
from __future__ import annotations

from locust import HttpUser, task, between, events
import random
import json


class VoiceSessionUser(HttpUser):
    """Simulate concurrent voice session users."""

    wait_time = between(1, 3)

    @task(3)
    def health_check(self):
        """Test health endpoint."""
        self.client.get("/health")

    @task(2)
    def check_availability(self):
        """Test availability checking."""
        self.client.post(
            "/api/messaging/process",
            json={
                "conversation_id": f"test-{random.randint(1000, 9999)}",
                "message": "Check availability for botox",
                "channel": "voice",
            },
        )

    @task(1)
    def book_appointment(self):
        """Test appointment booking."""
        self.client.post(
            "/api/messaging/process",
            json={
                "conversation_id": f"test-{random.randint(1000, 9999)}",
                "message": "Book me for tomorrow at 2pm",
                "channel": "voice",
            },
        )


class SMSMessagingUser(HttpUser):
    """Simulate SMS webhook traffic."""

    wait_time = between(2, 5)

    @task
    def receive_sms(self):
        """Test SMS webhook."""
        self.client.post(
            "/api/messaging/sms",
            data={
                "From": f"+1555{random.randint(1000000, 9999999)}",
                "Body": "I want to book an appointment",
                "MessageSid": f"SM{random.randint(100000, 999999)}",
            },
        )


class AdminDashboardUser(HttpUser):
    """Simulate admin dashboard usage."""

    wait_time = between(3, 8)

    @task(5)
    def view_metrics(self):
        """Test metrics endpoint."""
        self.client.get("/api/admin/metrics/overview?period=today")

    @task(3)
    def view_calls(self):
        """Test calls list endpoint."""
        self.client.get("/api/admin/calls?page=1&page_size=10")

    @task(2)
    def view_communications(self):
        """Test communications endpoint."""
        self.client.get("/api/admin/communications?page=1&page_size=10")

    @task(1)
    def view_appointments(self):
        """Test appointments endpoint."""
        self.client.get("/api/admin/appointments?page=1&page_size=10")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Initialize test data before load test."""
    print("Load test starting...")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Cleanup after load test."""
    print(f"Load test completed. Total requests: {environment.stats.num_requests}")
