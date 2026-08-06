from flask import Flask, render_template

app = Flask(__name__)

@app.get("/")
def dashboard():
    return render_template("dashboard.html")


@app.get("/posts/new")
def new_post():
    return render_template("create_post.html")


@app.get("/campaigns/new")
def new_campaign():
    return render_template("create_campaign.html")


if __name__ == "__main__":
    app.run(debug=True)