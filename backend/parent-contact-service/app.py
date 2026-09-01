"""
Parent Contact Service — AcademiQ
Handles: parent records + Twilio call/SMS integration.
PRIVACY NOTE: See inline comments for gaps to discuss with your guide.
"""

import os
from flask import Flask
from flask_cors import CORS
from models import db
from routes.parents import parents_bp
from routes.contact import contact_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    pg_user = os.getenv("POSTGRES_USER", "academiq")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "academiq_pass")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db   = os.getenv("POSTGRES_DB", "academiq")

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["TWILIO_ENABLED"]           = os.getenv("TWILIO_ENABLED", "false").lower() == "true"
    app.config["TWILIO_ACCOUNT_SID"]       = os.getenv("TWILIO_ACCOUNT_SID", "")
    app.config["TWILIO_AUTH_TOKEN"]        = os.getenv("TWILIO_AUTH_TOKEN", "")
    app.config["TWILIO_FROM_NUMBER"]       = os.getenv("TWILIO_FROM_NUMBER", "")
    app.config["TWILIO_PROXY_SERVICE_SID"] = os.getenv("TWILIO_PROXY_SERVICE_SID", "")

    db.init_app(app)

    app.register_blueprint(parents_bp, url_prefix="/parents")
    app.register_blueprint(contact_bp, url_prefix="/contact")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "parent-contact-service",
                "twilio_enabled": app.config["TWILIO_ENABLED"]}

    with app.app_context():
        db.create_all()
        _seed_demo()

    return app


def _seed_demo():
    from models import ParentRecord
    if ParentRecord.query.count() > 0:
        return

    # (student_id, parent_name, relationship, primary_mobile, alternate_mobile, method, consent)
    # Methods: Call | SMS | WhatsApp
    demo = [
        # Section A (STU001–STU035)
        ("STU001","Rajesh Sharma",        "Father","9876543210","9123456780","Call",    True),
        ("STU002","Meenakshi Rao",        "Mother","9876543211","",          "SMS",     True),
        ("STU003","Suresh Patel",         "Father","9876543212","9123456782","WhatsApp",True),
        ("STU004","Kamala Iyer",          "Mother","9876543213","",          "Call",    True),
        ("STU005","Rajan Nair",           "Father","9876543214","9123456784","Call",    False),
        ("STU006","Lalitha Krishnan",     "Mother","9876543215","",          "SMS",     True),
        ("STU007","Dinesh Mehta",         "Father","9876543216","9123456786","WhatsApp",True),
        ("STU008","Geetha Suresh",        "Mother","9876543217","",          "Call",    True),
        ("STU009","Anil Gupta",           "Father","9876543218","9123456788","SMS",     True),
        ("STU010","Vimala Menon",         "Mother","9876543219","",          "WhatsApp",True),
        ("STU011","Salim Sheikh",         "Father","9876543220","9123456790","Call",    True),
        ("STU012","Radha Pillai",         "Mother","9876543221","",          "SMS",     True),
        ("STU013","Srinivas Reddy",       "Father","9876543222","9123456792","Call",    True),
        ("STU014","Sunita Verma",         "Mother","9876543223","",          "WhatsApp",True),
        ("STU015","Bharat Thakkar",       "Father","9876543224","9123456794","SMS",     False),
        ("STU016","Savitha Srinivasan",   "Mother","9876543225","",          "Call",    True),
        ("STU017","Pradeep Bose",         "Father","9876543226","9123456796","WhatsApp",True),
        ("STU018","Sarada Narayan",       "Mother","9876543227","",          "SMS",     True),
        ("STU019","Ramkumar Tiwari",      "Father","9876543228","9123456798","Call",    True),
        ("STU020","Usha Pillai",          "Mother","9876543229","",          "Call",    True),
        ("STU021","Mahesh Joshi",         "Father","9876543230","9123456800","WhatsApp",True),
        ("STU022","Prabha Agarwal",       "Mother","9876543231","",          "SMS",     True),
        ("STU023","Venkat Kumar",         "Father","9876543232","9123456802","Call",    True),
        ("STU024","Jayalakshmi Shankar",  "Mother","9876543233","",          "WhatsApp",True),
        ("STU025","Vijayan Raj",          "Father","9876543234","9123456804","SMS",     False),
        ("STU026","Nalini Balaji",        "Mother","9876543235","",          "Call",    True),
        ("STU027","Sunil Desai",          "Father","9876543236","9123456806","WhatsApp",True),
        ("STU028","Padmavathi Natarajan", "Mother","9876543237","",          "SMS",     True),
        ("STU029","Deepak Saxena",        "Father","9876543238","9123456808","Call",    True),
        ("STU030","Sumathi Bhatt",        "Mother","9876543239","",          "WhatsApp",True),
        ("STU031","Mohan Pillai",         "Father","9876543240","9123456810","Call",    True),
        ("STU032","Hemalatha Kulkarni",   "Mother","9876543241","",          "SMS",     True),
        ("STU033","Balakrishnan Babu",    "Father","9876543242","9123456812","Call",    True),
        ("STU034","Meera Kapoor",         "Mother","9876543243","",          "WhatsApp",True),
        ("STU035","Raghunath Rao",        "Father","9876543244","9123456814","SMS",     True),

        # Section B (STU036–STU068)
        ("STU036","Narasimha Naidu",      "Father","9876543245","9123456815","Call",    True),
        ("STU037","Saroja Pandey",        "Mother","9876543246","",          "SMS",     True),
        ("STU038","Tapan Ghosh",          "Father","9876543247","9123456817","WhatsApp",True),
        ("STU039","Kamakshi Venkat",      "Mother","9876543248","",          "Call",    True),
        ("STU040","Shyam Mishra",         "Father","9876543249","9123456819","Call",    True),
        ("STU041","Kaveri Selvam",        "Mother","9876543250","",          "SMS",     False),
        ("STU042","Balamurugan A",        "Father","9876543251","9123456821","WhatsApp",True),
        ("STU043","Mangaladevi K",        "Mother","9876543252","",          "Call",    True),
        ("STU044","Subramaniam Ravi",     "Father","9876543253","9123456823","SMS",     True),
        ("STU045","Parvathi Hegde",       "Mother","9876543254","",          "WhatsApp",True),
        ("STU046","Prakashbhai Parekh",   "Father","9876543255","9123456825","Call",    True),
        ("STU047","Bhagirathi A",         "Mother","9876543256","",          "SMS",     True),
        ("STU048","Govindarajan R",       "Father","9876543257","9123456827","Call",    True),
        ("STU049","Sushila Nambiar",      "Mother","9876543258","",          "WhatsApp",True),
        ("STU050","Kishan Reddy",         "Father","9876543259","9123456829","SMS",     True),
        ("STU051","Visalakshi Devi",      "Mother","9876543260","",          "Call",    True),
        ("STU052","Krishnamurthy J",      "Father","9876543261","9123456831","WhatsApp",True),
        ("STU053","Pushpa Suresh",        "Mother","9876543262","",          "Call",    False),
        ("STU054","Ravi Shankar M",       "Father","9876543263","9123456833","SMS",     True),
        ("STU055","Sharada Ramesh",       "Mother","9876543264","",          "Call",    True),
        ("STU056","Sundaram Babu",        "Father","9876543265","9123456835","WhatsApp",True),
        ("STU057","Annapurna Shetty",     "Mother","9876543266","",          "SMS",     True),
        ("STU058","Muthuswamy Raj",       "Father","9876543267","9123456837","Call",    True),
        ("STU059","Vijayalakshmi K",      "Mother","9876543268","",          "WhatsApp",True),
        ("STU060","Nagaraj Kumar",        "Father","9876543269","9123456839","Call",    True),
        ("STU061","Gomathi Iyer",         "Mother","9876543270","",          "SMS",     True),
        ("STU062","Ramaiah Varma",        "Father","9876543271","9123456841","Call",    True),
        ("STU063","Saratha Kumar",        "Mother","9876543272","",          "WhatsApp",True),
        ("STU064","Damodaran Menon",      "Father","9876543273","9123456843","SMS",     True),
        ("STU065","Revathi R",            "Mother","9876543274","",          "Call",    True),
        ("STU066","Parthasarathy K",      "Father","9876543275","9123456845","WhatsApp",False),
        ("STU067","Tamilselvi Murali",    "Mother","9876543276","",          "Call",    True),
        ("STU068","Venkatesan B",         "Father","9876543277","9123456847","SMS",     True),

        # Section C (STU069–STU100)
        ("STU069","Pramod Jain",          "Father","9876543278","9123456848","Call",    True),
        ("STU070","Usha Srinivas",        "Mother","9876543279","",          "SMS",     True),
        ("STU071","Ashok Kumar A",        "Father","9876543280","9123456850","WhatsApp",True),
        ("STU072","Leela Desai",          "Mother","9876543281","",          "Call",    True),
        ("STU073","Shankar Patil",        "Father","9876543282","9123456852","SMS",     True),
        ("STU074","Bharati Venkat",       "Mother","9876543283","",          "WhatsApp",False),
        ("STU075","Subramania S",         "Father","9876543284","9123456854","Call",    True),
        ("STU076","Padma Devi",           "Mother","9876543285","",          "SMS",     True),
        ("STU077","Sekaran M",            "Father","9876543286","9123456856","Call",    True),
        ("STU078","Ambika Lakshmi",       "Mother","9876543287","",          "WhatsApp",True),
        ("STU079","Durai Kumar D",        "Father","9876543288","9123456858","SMS",     True),
        ("STU080","Elavarasi M",          "Mother","9876543289","",          "Call",    True),
        ("STU081","Ganesan R",            "Father","9876543290","9123456860","WhatsApp",True),
        ("STU082","Poomani T",            "Father","9876543291","9123456861","Call",    True),
        ("STU083","Hema Hariharan",       "Mother","9876543292","",          "SMS",     True),
        ("STU084","Indirani Raj",         "Mother","9876543293","",          "WhatsApp",True),
        ("STU085","Jayaraman M",          "Father","9876543294","9123456864","Call",    False),
        ("STU086","Kamalesh Devi",        "Father","9876543295","9123456865","SMS",     True),
        ("STU087","Lakshmi Karthik",      "Mother","9876543296","",          "Call",    True),
        ("STU088","Muruganantham A",      "Father","9876543297","9123456867","WhatsApp",True),
        ("STU089","Nirmala Logana",       "Mother","9876543298","",          "SMS",     True),
        ("STU090","Mahalakshmi A",        "Mother","9876543299","",          "Call",    True),
        ("STU091","Palaniswamy K",        "Father","9876543300","9123456870","WhatsApp",True),
        ("STU092","Nalini K",             "Mother","9876543301","",          "Call",    True),
        ("STU093","Palaniappan S",        "Father","9876543302","9123456872","SMS",     True),
        ("STU094","Pushpavalli S",        "Mother","9876543303","",          "WhatsApp",True),
        ("STU095","Ramasamy V",           "Father","9876543304","9123456874","Call",    True),
        ("STU096","Saroja Nair",          "Mother","9876543305","",          "SMS",     False),
        ("STU097","Ayyasamy A",           "Father","9876543306","9123456876","Call",    True),
        ("STU098","Meenakshi Rajan",      "Mother","9876543307","",          "WhatsApp",True),
        ("STU099","Thirumalai P",         "Father","9876543308","9123456878","SMS",     True),
        ("STU100","Vasantha Kiran",       "Mother","9876543309","",          "Call",    True),
    ]

    for sid, name, rel, primary, alt, method, consent in demo:
        p = ParentRecord(
            student_id=sid, parent_name=name, relationship=rel,
            primary_mobile=primary, alternate_mobile=alt or None,
            preferred_contact_method=method, consent_to_contact=consent,
        )
        db.session.add(p)
    db.session.commit()
    print(f"[parent-contact-service] {len(demo)} parent records seeded.")


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8003))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
