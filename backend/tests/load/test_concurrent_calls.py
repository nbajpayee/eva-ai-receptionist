"""
Load test for voice WebSocket connections.

Tests the system's ability to handle multiple concurrent voice calls.
Run this script to simulate realistic load before production demos.

Usage:
    python backend/tests/load/test_concurrent_calls.py

    # Or with custom parameters:
    python backend/tests/load/test_concurrent_calls.py --calls 100 --url ws://localhost:8000
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
from typing import Optional, Tuple

import websockets


async def simulate_voice_call(
    session_num: int,
    base_url: str,
    duration_seconds: int = 10,
) -> Tuple[bool, Optional[str]]:
    """
    Simulate one voice call session.

    Args:
        session_num: Call number for logging
        base_url: WebSocket base URL (e.g., "ws://localhost:8000")
        duration_seconds: How long to simulate the call

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    session_id = f"load-test-{uuid.uuid4()}"
    uri = f"{base_url}/ws/voice/{session_id}"

    try:
        async with websockets.connect(uri, ping_timeout=20) as ws:
            # Wait for greeting
            try:
                greeting = await asyncio.wait_for(ws.recv(), timeout=10)
                print(f"  Call {session_num:3d}: Connected, received greeting")
            except asyncio.TimeoutError:
                return False, "Timeout waiting for greeting"

            # Send 5 audio chunks (simulating ~5 seconds of speech)
            for i in range(5):
                await ws.send(json.dumps({
                    "type": "audio",
                    "data": "AAAA"  # Dummy base64 audio
                }))
                await asyncio.sleep(0.1)

            # Commit audio buffer
            await ws.send(json.dumps({"type": "commit"}))

            # Wait for response
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=15)
                print(f"  Call {session_num:3d}: Received AI response")
            except asyncio.TimeoutError:
                return False, "Timeout waiting for AI response"

            # Keep connection alive for remaining duration
            remaining = duration_seconds - 6  # 5 chunks + 1 commit already done
            if remaining > 0:
                await asyncio.sleep(remaining)

            # End session gracefully
            await ws.send(json.dumps({"type": "end_session"}))

            return True, None

    except websockets.exceptions.WebSocketException as e:
        return False, f"WebSocket error: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


async def load_test(
    num_calls: int = 50,
    base_url: str = "ws://localhost:8000",
    call_duration: int = 10
):
    """
    Run load test with N concurrent calls.

    Args:
        num_calls: Number of concurrent calls to simulate
        base_url: WebSocket base URL
        call_duration: Duration of each call in seconds
    """
    print(f"\n{'='*70}")
    print(f"LOAD TEST: {num_calls} concurrent voice calls")
    print(f"Target: {base_url}")
    print(f"Call duration: {call_duration} seconds")
    print(f"{'='*70}\n")

    start_time = datetime.now()

    # Create tasks for all calls
    tasks = [
        simulate_voice_call(i+1, base_url, call_duration)
        for i in range(num_calls)
    ]

    # Run all calls concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    # Analyze results
    success_count = 0
    fail_count = 0
    errors = {}

    for i, result in enumerate(results, 1):
        if isinstance(result, Exception):
            fail_count += 1
            error_msg = str(result)
            errors[error_msg] = errors.get(error_msg, 0) + 1
            print(f"  ❌ Call {i:3d}: Exception - {error_msg}")
        else:
            success, error_msg = result
            if success:
                success_count += 1
            else:
                fail_count += 1
                errors[error_msg] = errors.get(error_msg, 0) + 1
                print(f"  ❌ Call {i:3d}: Failed - {error_msg}")

    # Print summary
    print(f"\n{'='*70}")
    print(f"LOAD TEST RESULTS:")
    print(f"  Total calls:     {num_calls}")
    print(f"  Successful:      {success_count} ({success_count/num_calls*100:.1f}%)")
    print(f"  Failed:          {fail_count} ({fail_count/num_calls*100:.1f}%)")
    print(f"  Duration:        {duration:.2f}s")
    print(f"  Calls/sec:       {num_calls/duration:.2f}")
    print(f"{'='*70}")

    if errors:
        print(f"\nERROR BREAKDOWN:")
        for error_msg, count in sorted(errors.items(), key=lambda x: -x[1]):
            print(f"  {count:3d}x {error_msg}")

    print(f"\n{'='*70}")

    # Determine pass/fail
    success_rate = success_count / num_calls
    if success_rate >= 0.9:
        print(f"✅ PASS: {success_rate*100:.1f}% success rate (threshold: 90%)")
        return True
    else:
        print(f"❌ FAIL: {success_rate*100:.1f}% success rate (threshold: 90%)")
        return False


async def quick_test(base_url: str = "ws://localhost:8000"):
    """Run a quick connectivity test with a single call."""
    print(f"\n{'='*70}")
    print(f"QUICK CONNECTIVITY TEST")
    print(f"Target: {base_url}")
    print(f"{'='*70}\n")

    success, error_msg = await simulate_voice_call(1, base_url, duration_seconds=5)

    if success:
        print(f"\n✅ SUCCESS: WebSocket connection working")
        return True
    else:
        print(f"\n❌ FAILED: {error_msg}")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Load test for voice WebSocket connections")
    parser.add_argument(
        "--calls",
        type=int,
        default=50,
        help="Number of concurrent calls to simulate (default: 50)"
    )
    parser.add_argument(
        "--url",
        type=str,
        default="ws://localhost:8000",
        help="WebSocket base URL (default: ws://localhost:8000)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=10,
        help="Call duration in seconds (default: 10)"
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run quick connectivity test only (single call)"
    )

    args = parser.parse_args()

    # Run test
    try:
        if args.quick:
            passed = asyncio.run(quick_test(args.url))
        else:
            passed = asyncio.run(load_test(args.calls, args.url, args.duration))

        sys.exit(0 if passed else 1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
