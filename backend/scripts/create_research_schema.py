"""
Create research campaigns schema for outbound/research functionality.
Run this script to add research tables to your existing Supabase database.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text

from backend.database import SessionLocal, engine


def create_research_schema():
    """Create research campaigns tables."""

    sql_statements = [
        # Add conversation_type column to conversations table
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'conversations' AND column_name = 'conversation_type'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN conversation_type VARCHAR(50) DEFAULT 'inbound_service' NOT NULL;

                ALTER TABLE conversations
                ADD CONSTRAINT check_conversation_type
                CHECK (conversation_type IN ('inbound_service', 'research', 'outbound_sales'));
            END IF;
        END $$;
        """,
        # Add campaign_id column to conversations table
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'conversations' AND column_name = 'campaign_id'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN campaign_id UUID NULL;
            END IF;
        END $$;
        """,
        # Create research_campaigns table
        """
        CREATE TABLE IF NOT EXISTS research_campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('research', 'outbound_sales')),

            -- Segment criteria (stores filter conditions as JSON)
            segment_criteria JSONB NOT NULL DEFAULT '{}',

            -- Agent configuration (prompt, questions, voice settings)
            agent_config JSONB NOT NULL DEFAULT '{}',

            -- Channel selection
            channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'email', 'voice', 'multi')),

            -- Campaign status
            status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),

            -- Execution tracking
            total_targeted INTEGER DEFAULT 0,
            total_contacted INTEGER DEFAULT 0,
            total_responded INTEGER DEFAULT 0,

            -- Timestamps
            launched_at TIMESTAMPTZ NULL,
            completed_at TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            -- Future: admin user who created this
            created_by VARCHAR(255) NULL
        );

        CREATE INDEX IF NOT EXISTS idx_research_campaigns_status ON research_campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_research_campaigns_type ON research_campaigns(campaign_type);
        CREATE INDEX IF NOT EXISTS idx_research_campaigns_created_at ON research_campaigns(created_at DESC);
        """,
        # Create customer_segments table (for reusable segment definitions)
        """
        CREATE TABLE IF NOT EXISTS customer_segments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            description TEXT NULL,

            -- Segment criteria (same structure as campaign segment_criteria)
            criteria JSONB NOT NULL DEFAULT '{}',

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_customer_segments_name ON customer_segments(name);
        """,
        # Create manual_call_logs table (for staff-initiated calls)
        """
        CREATE TABLE IF NOT EXISTS manual_call_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

            -- Staff info
            staff_name VARCHAR(255) NULL,

            -- Pre-transcription notes
            call_notes TEXT NULL,

            -- Transcription status
            transcription_status VARCHAR(50) NOT NULL DEFAULT 'pending'
                CHECK (transcription_status IN ('pending', 'completed', 'failed')),

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_manual_call_logs_conversation ON manual_call_logs(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_manual_call_logs_status ON manual_call_logs(transcription_status);
        """,
        # Add foreign key constraint for campaign_id
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_conversations_campaign'
            ) THEN
                ALTER TABLE conversations
                ADD CONSTRAINT fk_conversations_campaign
                FOREIGN KEY (campaign_id) REFERENCES research_campaigns(id) ON DELETE SET NULL;

                CREATE INDEX idx_conversations_campaign_id ON conversations(campaign_id);
            END IF;
        END $$;
        """,
        # Create updated_at trigger for research_campaigns
        """
        CREATE OR REPLACE FUNCTION update_research_campaigns_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_research_campaigns_updated_at ON research_campaigns;
        CREATE TRIGGER trigger_research_campaigns_updated_at
            BEFORE UPDATE ON research_campaigns
            FOR EACH ROW
            EXECUTE FUNCTION update_research_campaigns_updated_at();
        """,
        # Create updated_at trigger for customer_segments
        """
        CREATE OR REPLACE FUNCTION update_customer_segments_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_customer_segments_updated_at ON customer_segments;
        CREATE TRIGGER trigger_customer_segments_updated_at
            BEFORE UPDATE ON customer_segments
            FOR EACH ROW
            EXECUTE FUNCTION update_customer_segments_updated_at();
        """,
    ]

    db = SessionLocal()
    try:
        for i, statement in enumerate(sql_statements, 1):
            print(f"Executing statement {i}/{len(sql_statements)}...")
            db.execute(text(statement))
            db.commit()

        print("\n✅ Research campaigns schema created successfully!")
        print("\nNew tables created:")
        print("  - research_campaigns")
        print("  - customer_segments")
        print("  - manual_call_logs")
        print("\nModified tables:")
        print("  - conversations (added conversation_type, campaign_id)")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error creating schema: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating research campaigns schema...")
    create_research_schema()
