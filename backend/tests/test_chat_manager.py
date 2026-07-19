import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.chat_manager import get_gemini_response

class TestChatManager(unittest.TestCase):

    @patch.dict(os.environ, {"GEMINI_API_KEY": ""})
    def test_get_gemini_response_missing_api_key(self):
        # When API key is missing, it should return a system warning warning that the API key is not set
        res = get_gemini_response("hello", [], {})
        self.assertIn("System Warning: Google Gemini API key", res)

    @patch.dict(os.environ, {"GEMINI_API_KEY": "fake_api_key"})
    @patch("requests.post")
    def test_get_gemini_response_success(self, mock_post):
        # Configure successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "This is a mock reply from Gemini."}
                        ]
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        history = [{"role": "user", "text": "Hi"}, {"role": "model", "text": "Hello!"}]
        user_context = {
            "first_name": "Mudasir",
            "full_name": "Mudasir Ali",
            "email": "mudasir@example.com",
            "disco": "K-Electric",
            "category_display": "Protected",
            "is_protected": "Yes",
            "is_lifeline": "No",
            "sanctioned_load": "2.0",
            "completeness_score": "15",
            "archetype": "House 12",
            "predicted_units": "180.5",
            "predicted_bill": "2500",
            "inventory": {"Standard Fans": "4 units"}
        }

        reply = get_gemini_response("Tell me how to save energy.", history, user_context)
        
        self.assertEqual(reply, "This is a mock reply from Gemini.")
        
        # Verify that requests.post was called with the correct URL and payload structure
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent", args[0])
        self.assertIn("key=fake_api_key", args[0])
        
        payload = kwargs["json"]
        self.assertIn("contents", payload)
        self.assertIn("systemInstruction", payload)
        
        # Verify history mapped to contents
        contents = payload["contents"]
        self.assertEqual(len(contents), 3) # 2 history elements + 1 new prompt
        self.assertEqual(contents[0]["role"], "user")
        self.assertEqual(contents[0]["parts"][0]["text"], "Hi")
        self.assertEqual(contents[1]["role"], "model")
        self.assertEqual(contents[1]["parts"][0]["text"], "Hello!")
        self.assertEqual(contents[2]["role"], "user")
        self.assertEqual(contents[2]["parts"][0]["text"], "Tell me how to save energy.")

    @patch.dict(os.environ, {"GEMINI_API_KEY": "fake_api_key"})
    @patch("requests.post")
    def test_get_gemini_response_api_error(self, mock_post):
        # Simulate non-200 API error
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response

        reply = get_gemini_response("hello", [], {})
        self.assertIn("AI Service Error: Received status code 500", reply)

    @patch.dict(os.environ, {"GEMINI_API_KEY": "fake_api_key"})
    @patch("requests.post")
    def test_get_gemini_response_connection_error(self, mock_post):
        # Simulate connection exception
        mock_post.side_effect = Exception("Connection Timed Out")

        reply = get_gemini_response("hello", [], {})
        self.assertIn("System Connection Error: Could not connect to Gemini API", reply)

if __name__ == '__main__':
    unittest.main()
