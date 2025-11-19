"""
Research and outbound campaign API endpoints.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from research.agent_templates import AgentTemplates
from research.campaign_service import CampaignService
from research.segmentation_service import SegmentationService

router = APIRouter(prefix="/api/admin/research", tags=["research"])


# ==================== Request/Response Models ====================


class SegmentCriteria(BaseModel):
    """Segment criteria model."""

    channel: Optional[str] = None
    has_booking_intent: Optional[bool] = None
    has_appointment: Optional[bool] = None
    days_since_last_contact: Optional[int] = None
    days_since_last_appointment: Optional[int] = None
    days_since_last_activity: Optional[int] = None
    min_satisfaction_score: Optional[int] = None
    max_satisfaction_score: Optional[int] = None
    outcome: Optional[List[str]] = None
    appointment_count: Optional[int] = None
    last_appointment_status: Optional[str] = None
    days_since_cancellation: Optional[int] = None


class AgentConfig(BaseModel):
    """Agent configuration model."""

    system_prompt: str
    questions: List[str]
    voice_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CreateCampaignRequest(BaseModel):
    """Create campaign request model."""

    name: str
    campaign_type: str  # research or outbound_sales
    segment_criteria: Dict[str, Any]
    agent_config: Dict[str, Any]
    channel: str  # sms, email, voice, multi
    created_by: Optional[str] = None


class UpdateCampaignRequest(BaseModel):
    """Update campaign request model."""

    name: Optional[str] = None
    segment_criteria: Optional[Dict[str, Any]] = None
    agent_config: Optional[Dict[str, Any]] = None
    channel: Optional[str] = None


class SaveSegmentRequest(BaseModel):
    """Save segment request model."""

    name: str
    description: Optional[str] = None
    criteria: Dict[str, Any]


# ==================== Segment Endpoints ====================


@router.get("/segments/templates")
def get_segment_templates():
    """Get pre-built segment templates."""
    return {"success": True, "templates": SegmentationService.get_templates()}


@router.post("/segments/preview")
def preview_segment(criteria: Dict[str, Any], db: Session = Depends(get_db)):
    """Preview a segment (get count and sample customers)."""
    try:
        result = SegmentationService.preview_segment(db, criteria)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/segments")
def get_saved_segments(db: Session = Depends(get_db)):
    """Get all saved segments."""
    segments = SegmentationService.get_saved_segments(db)
    return {
        "success": True,
        "segments": [
            {
                "id": str(seg.id),
                "name": seg.name,
                "description": seg.description,
                "criteria": seg.criteria,
                "created_at": seg.created_at.isoformat() if seg.created_at else None,
            }
            for seg in segments
        ],
    }


@router.post("/segments")
def save_segment(request: SaveSegmentRequest, db: Session = Depends(get_db)):
    """Save a segment definition for reuse."""
    try:
        segment = SegmentationService.save_segment(
            db,
            name=request.name,
            description=request.description,
            criteria=request.criteria,
        )
        return {
            "success": True,
            "segment_id": str(segment.id),
            "segment": {
                "id": str(segment.id),
                "name": segment.name,
                "description": segment.description,
                "criteria": segment.criteria,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/segments/{segment_id}")
def delete_segment(segment_id: str, db: Session = Depends(get_db)):
    """Delete a saved segment."""
    success = SegmentationService.delete_segment(db, segment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Segment not found")

    return {"success": True, "message": "Segment deleted"}


# ==================== Agent Template Endpoints ====================


@router.get("/agent-templates")
def get_agent_templates(
    campaign_type: Optional[str] = Query(None, description="Filter by campaign type")
):
    """Get agent templates."""
    if campaign_type:
        templates = AgentTemplates.get_templates_by_type(campaign_type)
    else:
        templates = AgentTemplates.get_all_templates()

    return {"success": True, "templates": templates}


@router.get("/agent-templates/{template_id}")
def get_agent_template(template_id: str):
    """Get a specific agent template."""
    template = AgentTemplates.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"success": True, "template": template}


@router.post("/agent-templates/validate")
def validate_agent_config(config: AgentConfig):
    """Validate an agent configuration."""
    is_valid, errors = AgentTemplates.validate_agent_config(config.dict())
    return {"success": True, "is_valid": is_valid, "errors": errors}


# ==================== Campaign Endpoints ====================


@router.post("/campaigns")
def create_campaign(request: CreateCampaignRequest, db: Session = Depends(get_db)):
    """Create a new research/outbound campaign."""
    try:
        campaign = CampaignService.create_campaign(
            db=db,
            name=request.name,
            campaign_type=request.campaign_type,
            segment_criteria=request.segment_criteria,
            agent_config=request.agent_config,
            channel=request.channel,
            created_by=request.created_by,
        )

        return {
            "success": True,
            "campaign_id": str(campaign.id),
            "campaign": serialize_campaign(campaign),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaigns")
def list_campaigns(
    status: Optional[str] = Query(None, description="Filter by status"),
    campaign_type: Optional[str] = Query(None, description="Filter by type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List campaigns with filtering and pagination."""
    result = CampaignService.list_campaigns(
        db=db, status=status, campaign_type=campaign_type, limit=limit, offset=offset
    )

    return {
        "success": True,
        "campaigns": [serialize_campaign(c) for c in result["campaigns"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Get a single campaign with details."""
    campaign = CampaignService.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return {"success": True, "campaign": serialize_campaign(campaign)}


@router.patch("/campaigns/{campaign_id}")
def update_campaign(
    campaign_id: str, request: UpdateCampaignRequest, db: Session = Depends(get_db)
):
    """Update a campaign (only draft campaigns)."""
    try:
        updates = request.dict(exclude_unset=True)
        campaign = CampaignService.update_campaign(db, campaign_id, updates)

        return {"success": True, "campaign": serialize_campaign(campaign)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/launch")
def launch_campaign(
    campaign_id: str,
    limit: Optional[int] = Query(
        None, description="Limit number of customers (for testing)"
    ),
    db: Session = Depends(get_db),
):
    """Launch a campaign and begin outbound execution."""
    try:
        from database import SessionLocal
        from research.outbound_service import OutboundService

        # Launch campaign (changes status to active)
        campaign = CampaignService.launch_campaign(db, campaign_id)

        # Automatically execute outbound communications
        outbound_service = OutboundService(db_session_factory=SessionLocal)
        execution_results = outbound_service.execute_campaign(
            db=db, campaign_id=campaign.id, limit=limit
        )

        return {
            "success": True,
            "campaign": serialize_campaign(campaign),
            "execution": execution_results,
            "message": f"Campaign launched and {execution_results['successful']} customers contacted",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Launch failed: {str(e)}")


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Pause an active campaign."""
    try:
        campaign = CampaignService.pause_campaign(db, campaign_id)
        return {
            "success": True,
            "campaign": serialize_campaign(campaign),
            "message": "Campaign paused",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Resume a paused campaign."""
    try:
        campaign = CampaignService.resume_campaign(db, campaign_id)
        return {
            "success": True,
            "campaign": serialize_campaign(campaign),
            "message": "Campaign resumed",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/complete")
def complete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Mark campaign as completed."""
    try:
        campaign = CampaignService.complete_campaign(db, campaign_id)
        return {
            "success": True,
            "campaign": serialize_campaign(campaign),
            "message": "Campaign completed",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaigns/{campaign_id}/execute")
def execute_campaign(
    campaign_id: str,
    limit: Optional[int] = Query(
        None, description="Limit number of customers (for testing)"
    ),
    db: Session = Depends(get_db),
):
    """
    Execute campaign outbound communications.
    Sends messages to all customers in the campaign segment.
    """
    try:
        from database import SessionLocal
        from research.outbound_service import OutboundService

        # Create outbound service
        outbound_service = OutboundService(db_session_factory=SessionLocal)

        # Execute campaign
        results = outbound_service.execute_campaign(
            db=db, campaign_id=campaign_id, limit=limit
        )

        return {"success": True, **results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Delete a campaign (only draft or completed)."""
    try:
        success = CampaignService.delete_campaign(db, campaign_id)
        if not success:
            raise HTTPException(status_code=404, detail="Campaign not found")

        return {"success": True, "message": "Campaign deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str, db: Session = Depends(get_db)):
    """Get detailed campaign statistics."""
    try:
        stats = CampaignService.get_campaign_stats(db, campaign_id)
        return {"success": True, **stats}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/campaigns/{campaign_id}/conversations")
def get_campaign_conversations(
    campaign_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get conversations for a campaign."""
    try:
        result = CampaignService.get_campaign_conversations(
            db=db, campaign_id=campaign_id, limit=limit, offset=offset
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ==================== Helper Functions ====================


def serialize_campaign(campaign) -> Dict[str, Any]:
    """Serialize a campaign object to dictionary."""
    return {
        "id": str(campaign.id),
        "name": campaign.name,
        "campaign_type": campaign.campaign_type,
        "segment_criteria": campaign.segment_criteria,
        "agent_config": campaign.agent_config,
        "channel": campaign.channel,
        "status": campaign.status,
        "total_targeted": campaign.total_targeted,
        "total_contacted": campaign.total_contacted,
        "total_responded": campaign.total_responded,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "launched_at": (
            campaign.launched_at.isoformat() if campaign.launched_at else None
        ),
        "completed_at": (
            campaign.completed_at.isoformat() if campaign.completed_at else None
        ),
        "created_by": campaign.created_by,
    }
