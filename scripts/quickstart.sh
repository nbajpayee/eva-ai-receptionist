#!/bin/bash
set -e

echo "🚀 Eva AI Receptionist - Quick Start Setup"
echo "==========================================="
echo ""

# Check Python version
echo "1️⃣  Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.11"

if [[ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]]; then
    echo "❌ Python 3.11+ required. Found: $python_version"
    echo "   Install Python 3.11: https://www.python.org/downloads/"
    exit 1
fi
echo "✅ Python $python_version found"
echo ""

# Check if virtual environment exists
echo "2️⃣  Setting up virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "ℹ️  Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate || . venv/Scripts/activate
echo "✅ Virtual environment activated"
echo ""

# Upgrade pip
echo "3️⃣  Upgrading pip..."
pip install --upgrade pip --quiet
echo "✅ Pip upgraded"
echo ""

# Install dependencies
echo "4️⃣  Installing dependencies..."
echo "   This may take a few minutes..."
cd backend
pip install -r requirements.txt --quiet
pip install -r requirements-test.txt --quiet
cd ..
echo "✅ Dependencies installed"
echo ""

# Check .env file
echo "5️⃣  Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️  Created .env from template"
        echo "   ⚠️  YOU MUST UPDATE .env WITH YOUR CREDENTIALS!"
        echo "   Required: DATABASE_URL, OPENAI_API_KEY, GOOGLE_CALENDAR_ID"
    else
        echo "❌ No .env.example found"
        echo "   Create .env manually with required credentials"
    fi
else
    echo "✅ .env file exists"
fi
echo ""

# Install pre-commit hooks (if available)
echo "6️⃣  Setting up pre-commit hooks..."
if command -v pre-commit &> /dev/null; then
    pre-commit install --quiet
    echo "✅ Pre-commit hooks installed"
else
    echo "ℹ️  pre-commit not found (optional)"
    echo "   Install with: pip install pre-commit && pre-commit install"
fi
echo ""

# Initialize database
echo "7️⃣  Initializing database..."
if [ -f "backend/scripts/create_supabase_schema.py" ]; then
    python backend/scripts/create_supabase_schema.py 2>/dev/null || echo "ℹ️  Database initialization skipped (configure .env first)"
else
    echo "ℹ️  Database script not found (will auto-initialize on first run)"
fi
echo ""

# Run tests (quick check)
echo "8️⃣  Running test suite..."
cd backend
pytest --collect-only -q 2>/dev/null && echo "✅ Tests discovered: $(pytest --collect-only -q 2>&1 | tail -n1)" || echo "⚠️  Fix .env to run tests"
cd ..
echo ""

echo "============================================"
echo "✨ Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Update .env with your credentials"
echo "  2. Start backend: cd backend && uvicorn main:app --reload"
echo "  3. Visit: http://localhost:8000/docs (API documentation)"
echo "  4. Run tests: cd backend && pytest"
echo ""
echo "Documentation:"
echo "  - TEST_SUITE_SUMMARY.md - Test documentation"
echo "  - NEXT_STEPS.md - Production roadmap"
echo "  - SECURITY_AUDIT_CHECKLIST.md - HIPAA compliance"
echo ""
echo "To activate environment in future: source venv/bin/activate"
echo ""
