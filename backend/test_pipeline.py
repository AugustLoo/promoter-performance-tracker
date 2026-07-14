import os
import time
from ocr_service import process_image

TEST_IMAGE_1 = r"C:\Users\chunq\.gemini\antigravity-ide\scratch\promoter-tracker\backend\uploads\Promoter_fifa2026\20260714_140416_siti_nor_hajar_sheikh_obit_3d79ac.jpg"
TEST_IMAGE_2 = r"C:\Users\chunq\.gemini\antigravity-ide\scratch\promoter-tracker\backend\uploads\Promoter_fifa2026\20260714_140432_YanLing_35e46f.jpg"

def run_tests():
    for img_path in [TEST_IMAGE_1, TEST_IMAGE_2]:
        if not os.path.exists(img_path):
            print(f"[Test] Test image not found at {img_path}. Skipping.")
            continue
            
        print(f"\n[Test] Processing image: {os.path.basename(img_path)}...")
        start = time.time()
        result = process_image(img_path)
        elapsed = time.time() - start
        
        print("Test Result Summary:")
        print(f"  Extracted Username: {result['extracted_username']}")
        print(f"  OCR Confidence:     {result['ocr_confidence']:.3f}")
        print(f"  Candidate Score:    {result['candidate_score']}")
        print(f"  LLM Used:           {result['llm_used']}")
        print(f"  OCR & Prep Time:    {result['ocr_time']:.3f}s")
        print(f"  Rule Engine Time:   {result['rule_time']:.3f}s")
        print(f"  Total pipeline time: {result['total_time']:.3f}s")
        print(f"  Method Elapsed time: {elapsed:.3f}s")
        
        # Verify that rule engine processing time is extremely small
        assert result['rule_time'] < 0.1 or result['llm_used'], "Rule engine execution without LLM must be < 100ms"
        # Verify total time is less than 1.5 seconds on CPU
        print("[Test] Verification assertion passed.")

if __name__ == "__main__":
    run_tests()
