import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv #read key value pairs from .env file and set them as environment variables
from google import genai

