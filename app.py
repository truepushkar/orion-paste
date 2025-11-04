import os
import string
import random
import secrets
from datetime import datetime, timedelta
from flask import (
    Flask, render_template, request, redirect,
    url_for, abort, Response, flash
)
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-key")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/pastebin")
BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")

# Configure MongoDB client with connection pooling for better performance
client = MongoClient(
    MONGODB_URI,
    maxPoolSize=50,
    minPoolSize=10,
    maxIdleTimeMS=45000,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000
)
db = client["pastebin"]
pastes = db.pastes

# Create indexes for better query performance
try:
    pastes.create_index([("slug", ASCENDING)], unique=True, background=True)
    pastes.create_index([("expires_at", ASCENDING)], background=True)
    pastes.create_index([("created_at", ASCENDING)], background=True)
except Exception as e:
    app.logger.warning(f"Failed to create indexes: {e}")

ALPHABET = string.ascii_letters + string.digits

def gen_slug(n=7):
    """Generate a cryptographically secure random slug using secrets module."""
    return ''.join(secrets.choice(ALPHABET) for _ in range(n))

def get_paste_or_404(slug):
    """Fetch a paste by slug with expiration check."""
    paste = pastes.find_one({"slug": slug})
    if not paste:
        abort(404)
    
    # Check expiration with single datetime call
    now = datetime.utcnow()
    if paste.get("expires_at") and now > paste["expires_at"]:
        pastes.delete_one({"_id": paste["_id"]})
        abort(404)
    return paste

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/create", methods=["POST"])
def create():
    title = request.form.get("title", "")
    language = request.form.get("language", "")
    content = request.form.get("content", "")
    expire_days = request.form.get("expire_days", type=int)
    password = request.form.get("password", "")

    if not content.strip():
        flash("Paste content cannot be empty", "error")
        return redirect(url_for("index"))

    # Optimized slug generation: generate cryptographically secure slug
    # The probability of collision with secrets module is extremely low
    # but we still check once for safety
    slug = gen_slug(7)
    
    # Single database check - if collision (very rare), use ObjectId
    if pastes.find_one({"slug": slug}, {"_id": 1}):
        slug = str(ObjectId())[:8]

    # Single datetime call for consistency
    now = datetime.utcnow()
    
    paste = {
        "slug": slug,
        "title": title,
        "language": language,
        "content": content,
        "created_at": now,
        "expires_at": None,
        "password_hash": generate_password_hash(password) if password else None
    }

    if expire_days and expire_days > 0:
        paste["expires_at"] = now + timedelta(days=expire_days)

    pastes.insert_one(paste)
    return redirect(url_for("view_paste", slug=slug))

@app.route("/p/<slug>")
def view_paste(slug):
    paste = get_paste_or_404(slug)
    return render_template("paste.html", paste=paste, base_url=BASE_URL)

@app.route("/edit/<slug>", methods=["GET", "POST"])
def edit_paste(slug):
    paste = get_paste_or_404(slug)
    if not paste.get("password_hash"):
        flash("This paste is not editable (no password was set).", "error")
        return redirect(url_for("view_paste", slug=slug))

    if request.method == "POST":
        password = request.form.get("password", "")
        if not check_password_hash(paste["password_hash"], password):
            flash("Incorrect password.", "error")
            return redirect(url_for("edit_paste", slug=slug))

        new_content = request.form.get("content", "")
        if not new_content.strip():
            flash("Content cannot be empty.", "error")
            return redirect(url_for("edit_paste", slug=slug))

        # Single update with all fields at once
        pastes.update_one(
            {"_id": paste["_id"]}, 
            {"$set": {
                "content": new_content,
                "title": request.form.get("title", paste["title"]),
                "language": request.form.get("language", paste["language"]),
                "updated_at": datetime.utcnow()
            }}
        )
        flash("Paste updated successfully!", "success")
        return redirect(url_for("view_paste", slug=slug))

    return render_template("edit.html", paste=paste)

@app.route("/raw/<slug>")
def raw_paste(slug):
    paste = get_paste_or_404(slug)
    return Response(paste["content"], mimetype="text/plain; charset=utf-8")

@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404

@app.errorhandler(ServerSelectionTimeoutError)
@app.errorhandler(ConnectionFailure)
def handle_db_error(e):
    """Handle database connection errors gracefully."""
    app.logger.error(f"Database connection error: {e}")
    return render_template("error.html", error="Database connection failed. Please try again later."), 503

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=False)
