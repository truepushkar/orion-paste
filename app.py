import os
import string
import random
from datetime import datetime, timedelta
from urllib.parse import quote_plus

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    abort,
    Response,
    flash,
)
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-key")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/pastebin")
BASE_URL = os.getenv("BASE_URL", "http://localhost:5000")

client = MongoClient(MONGODB_URI)
db = client.get_default_database()
pastes = db.pastes

# Utility: short slug generator (base62-like)
ALPHABET = string.ascii_letters + string.digits

def gen_slug(n=7):
    return ''.join(random.choice(ALPHABET) for _ in range(n))


def get_paste_or_404(slug):
    paste = pastes.find_one({"slug": slug})
    if not paste:
        abort(404)
    # check expiry
    if paste.get("expires_at"):
        if datetime.utcnow() > paste["expires_at"]:
            # Optionally delete expired paste
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

    if not content:
        flash("Paste content cannot be empty", "error")
        return redirect(url_for("index"))

    # ensure unique slug
    for _ in range(5):
        slug = gen_slug(7)
        if not pastes.find_one({"slug": slug}):
            break
    else:
        # fallback to ObjectId-based slug
        slug = str(ObjectId())[:8]

    paste = {
        "slug": slug,
        "title": title,
        "language": language,
        "content": content,
        "created_at": datetime.utcnow(),
        "expires_at": None,
    }

    if expire_days and expire_days > 0:
        paste["expires_at"] = datetime.utcnow() + timedelta(days=expire_days)

    pastes.insert_one(paste)

    return redirect(url_for("view_paste", slug=slug))


@app.route("/p/<slug>")
def view_paste(slug):
    paste = get_paste_or_404(slug)
    return render_template("paste.html", paste=paste, base_url=BASE_URL)


@app.route("/raw/<slug>")
def raw_paste(slug):
    paste = get_paste_or_404(slug)
    return Response(paste["content"], mimetype="text/plain; charset=utf-8")


@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True)