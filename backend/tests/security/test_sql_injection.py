"""
Security tests for SQL injection vulnerabilities.

These tests attempt various SQL injection techniques to ensure
the application properly sanitizes inputs and uses parameterized queries.
"""
from __future__ import annotations

import pytest

from database import Customer, Appointment, Conversation


@pytest.mark.security
class TestSQLInjection:
    """Test protection against SQL injection attacks."""

    @pytest.mark.parametrize("malicious_input", [
        "'; DROP TABLE customers; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM customers --",
        "'; DELETE FROM appointments WHERE '1'='1",
        "admin'--",
        "' OR 1=1--",
        "1'; UPDATE customers SET phone='hacked' WHERE '1'='1",
        "' OR 'a'='a",
    ])
    def test_customer_query_injection(self, db_session, malicious_input):
        """Test SQL injection attempts in customer queries."""
        # Attempt to query customer with malicious input
        result = db_session.query(Customer).filter(
            Customer.phone == malicious_input
        ).first()

        # Should return None (no match), not execute injection
        assert result is None

        # Verify tables still exist
        customers = db_session.query(Customer).all()
        assert isinstance(customers, list)  # Query should succeed

    @pytest.mark.parametrize("malicious_email", [
        "test'; DROP TABLE appointments; --@example.com",
        "admin' OR '1'='1@example.com",
        "user'--@example.com",
    ])
    def test_appointment_query_injection(self, db_session, malicious_email):
        """Test SQL injection in appointment queries."""
        result = db_session.query(Customer).filter(
            Customer.email == malicious_email
        ).first()

        assert result is None

        # Verify appointments table exists
        appointments = db_session.query(Appointment).all()
        assert isinstance(appointments, list)

    def test_conversation_query_injection(self, db_session):
        """Test SQL injection in conversation queries."""
        malicious_channel = "voice'; DROP TABLE conversations; --"

        result = db_session.query(Conversation).filter(
            Conversation.channel == malicious_channel
        ).first()

        assert result is None

        # Verify conversations table exists
        conversations = db_session.query(Conversation).all()
        assert isinstance(conversations, list)

    def test_orm_query_safety(self, db_session, customer):
        """Verify ORM queries are safe from injection."""
        # ORM should use parameterized queries
        malicious_name = "'; DROP TABLE customers; --"

        customer.name = malicious_name
        db_session.commit()

        # Query back
        found = db_session.query(Customer).filter(
            Customer.name == malicious_name
        ).first()

        assert found is not None
        assert found.name == malicious_name

        # Tables should still exist
        count = db_session.query(Customer).count()
        assert count >= 1

    def test_like_query_injection(self, db_session):
        """Test SQL injection in LIKE queries."""
        malicious_pattern = "%'; DROP TABLE customers; --"

        results = db_session.query(Customer).filter(
            Customer.name.like(malicious_pattern)
        ).all()

        # Should not execute injection
        assert isinstance(results, list)

        # Verify table exists
        all_customers = db_session.query(Customer).all()
        assert isinstance(all_customers, list)

    def test_union_based_injection(self, db_session):
        """Test UNION-based SQL injection attempts."""
        malicious_union = "1' UNION SELECT id, name, phone FROM customers --"

        result = db_session.query(Customer).filter(
            Customer.phone == malicious_union
        ).first()

        assert result is None

    def test_boolean_based_injection(self, db_session):
        """Test boolean-based blind SQL injection."""
        malicious_bool = "' OR '1'='1' --"

        result = db_session.query(Customer).filter(
            Customer.email == malicious_bool
        ).first()

        # Should not return all records
        assert result is None

    def test_time_based_injection(self, db_session):
        """Test time-based blind SQL injection."""
        malicious_time = "'; WAITFOR DELAY '00:00:05'; --"

        import time
        start = time.time()

        result = db_session.query(Customer).filter(
            Customer.phone == malicious_time
        ).first()

        elapsed = time.time() - start

        # Should not execute WAITFOR/SLEEP
        assert elapsed < 2.0  # Should be fast
        assert result is None
