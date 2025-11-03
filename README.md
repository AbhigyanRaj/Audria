# Audria - Advanced Call Center Solution

## Project Overview
Audria is a comprehensive call center solution with advanced Answering Machine Detection (AMD) capabilities using multiple AI models (Gemini, HuggingFace, and custom ML models).

## Architecture
- **Frontend**: Next.js 16 application with WebSocket support
- **Backend**: Integrated Next.js API routes with WebSocket servers
- **AMD Service**: Python FastAPI microservice for ML-based detection
- **Database**: PostgreSQL with Prisma ORM

## Current Status

### ✅ Completed Features

#### Authentication & Dashboard
- User authentication system
- Dashboard layout and navigation
- Settings management interface

#### Call Handling
- Voice call initialization
- Twilio integration
- Media streaming setup
- Real-time call monitoring

#### AMD Implementation
1. **Gemini AMD (100%)**
   - Real-time audio processing
   - Confidence scoring
   - WebSocket handler for streaming
   - Integration with Twilio Media Streams

2. **Python ML Service (75%)**
   - Multiple model support (Whisper, Wav2Vec2, VAD)
   - REST API endpoint
   - Streaming WebSocket endpoint
   - Ensemble decision making

3. **HuggingFace Integration (25%)**
   - API configuration
   - Service wrapper
   - Audio conversion utilities

### 🚧 In Progress

1. **AMD Optimization**
   - Fine-tuning model parameters
   - Improving accuracy metrics
   - Reducing latency

2. **Call Analytics**
   - Call statistics dashboard
   - Performance metrics
   - Success rate tracking

### ❌ Pending Tasks

1. **HuggingFace Integration**
   - WebSocket handler for Twilio streams
   - Real-time processing optimization
   - Model fine-tuning

2. **Testing & Documentation**
   - End-to-end testing suite
   - Load testing
   - API documentation
   - Deployment guide

## Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL
- Docker (optional)

### Environment Variables
Create a `.env` file with the following (see `.env.example`):
```
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number

# AI Services
HUGGINGFACE_API_KEY=your_key
GEMINI_API_KEY=your_key

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_db_name
```

### Installation

1. **Frontend & Main Server**
```bash
cd frontend
npm install
npm run dev
```

2. **Python AMD Service**
```bash
cd python-amd-service
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python main.py
```

3. **Database Setup**
```bash
cd frontend
npx prisma migrate dev
```

## Architecture Diagram
```
┌─────────────┐         ┌──────────────┐
│   Next.js   │◄───────►│   Twilio     │
│   Frontend  │         │   Services    │
└─────┬───────┘         └──────────────┘
      │
┌─────┴───────┐         ┌──────────────┐
│  WebSocket  │◄───────►│    Gemini    │
│   Server    │         │      AI      │
└─────┬───────┘         └──────────────┘
      │
┌─────┴───────┐         ┌──────────────┐
│   Python    │◄───────►│  HuggingFace │
│ AMD Service │         │      ML      │
└─────┬───────┘         └──────────────┘
      │
┌─────┴───────┐
│  PostgreSQL │
│  Database   │
└─────────────┘
```

## Next Steps
1. Complete HuggingFace WebSocket integration
2. Implement remaining analytics features
3. Conduct comprehensive testing
4. Prepare deployment documentation

## Contributing
1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License
Proprietary - All rights reserved