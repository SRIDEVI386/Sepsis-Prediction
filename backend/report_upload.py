
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from auth import get_current_user, User
from pathlib import Path
import csv
import io
import re

router = APIRouter(tags=["Report Upload"])

MAX_FILE_SIZE = 5 * 1024 * 1024

VITAL_PATTERNS = {
    "HR": [
        r"\bheart\s*rate\b",
        r"\bHR\b",
        r"\bpulse\s*rate\b",
        r"\bpulse\b",
    ],
    "O2Sat": [
        r"\boxygen\s*saturation\b",
        r"\bO2\s*sat(?:uration)?\b",
        r"\bSpO2\b",
        r"\bO2Sat\b",
    ],
    "Temp": [
        r"\btemperature\b",
        r"\btemp\b",
    ],
    "SBP": [
        r"\bsystolic\s*(?:blood\s*)?pressure\b",
        r"\bSBP\b",
    ],
    "DBP": [
        r"\bdiastolic\s*(?:blood\s*)?pressure\b",
        r"\bDBP\b",
    ],
    "MAP": [
        r"\bmean\s*arterial\s*pressure\b",
        r"\bMAP\b",
    ],
    "Resp": [
        r"\brespiratory\s*rate\b",
        r"\bresp(?:iration)?\s*rate\b",
        r"\bResp\b",
    ],
    "EtCO2": [
        r"\bend[-\s]*tidal\s*CO2\b",
        r"\bEtCO2\b",
    ],
}


def parse_number(value):
    if value is None:
        return None

    match = re.search(r"-?\d+(?:\.\d+)?", str(value))

    if not match:
        return None

    try:
        return float(match.group())
    except ValueError:
        return None


def extract_from_text(text):
    extracted = {}

    # Process each line separately so a vital name cannot
    # accidentally capture a number from a later vital sign.
    for line in text.splitlines():
        line = line.strip()

        if not line:
            continue

        for vital, patterns in VITAL_PATTERNS.items():
            if vital in extracted:
                continue

            for pattern in patterns:
                # Supports:
                # Heart Rate: 120 bpm
                # HR: 120
                # Oxygen Saturation (O2Sat): 91 %
                # Temperature (Temp): 39.0 C
                regex = re.compile(
                    pattern
                    + r"(?:\s*\([^)]*\))?"
                    + r"\s*(?:is\s*)?[:=\-]?\s*"
                    + r"(-?\d+(?:\.\d+)?)",
                    re.IGNORECASE,
                )

                match = regex.search(line)

                if match:
                    value = parse_number(match.group(1))

                    if value is not None:
                        extracted[vital] = value
                        break

    return extracted


def extract_from_csv(content):
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV file has no column headers.",
        )

    aliases = {
        "hr": "HR",
        "heartrate": "HR",
        "pulse": "HR",
        "pulserate": "HR",
        "o2sat": "O2Sat",
        "spo2": "O2Sat",
        "oxygensaturation": "O2Sat",
        "temperature": "Temp",
        "temp": "Temp",
        "sbp": "SBP",
        "systolicbp": "SBP",
        "systolicbloodpressure": "SBP",
        "map": "MAP",
        "meanarterialpressure": "MAP",
        "dbp": "DBP",
        "diastolicbp": "DBP",
        "diastolicbloodpressure": "DBP",
        "resp": "Resp",
        "respiratoryrate": "Resp",
        "etco2": "EtCO2",
    }

    readings = []

    for row in reader:
        reading = {}

        for column, value in row.items():
            if not column:
                continue

            normalized = re.sub(
                r"[^a-z0-9]",
                "",
                column.lower(),
            )

            vital = aliases.get(normalized)

            if vital:
                parsed = parse_number(value)

                if parsed is not None:
                    reading[vital] = parsed

        if reading:
            readings.append(reading)

    if not readings:
        raise HTTPException(
            status_code=422,
            detail="No supported vital-sign columns found in CSV.",
        )

    return readings


async def read_pdf(content):
    try:
        import fitz

        document = fitz.open(stream=content, filetype="pdf")

        if len(document) > 30:
            document.close()
            raise HTTPException(
                status_code=400,
                detail="PDF must contain no more than 30 pages.",
            )

        text = "\n".join(page.get_text() for page in document)
        document.close()

        if not text.strip():
            raise HTTPException(
                status_code=422,
                detail="No readable text found in PDF. Scanned PDFs may require OCR.",
            )

        return text

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="Could not read this PDF. Scanned PDFs may require OCR.",
        )


@router.post("/api/reports/extract")
async def extract_report(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    if extension not in {".pdf", ".csv", ".txt"}:
        raise HTTPException(
            status_code=400,
            detail="Upload a PDF, CSV, or TXT file.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must be 5 MB or less.",
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if extension == ".csv":
        readings = extract_from_csv(content)

    else:
        if extension == ".pdf":
            text = await read_pdf(content)
        else:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = content.decode("latin-1")

        values = extract_from_text(text)

        if not values:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No supported vital signs were detected. "
                    "Use labels such as HR: 120, O2Sat: 91, "
                    "Temp: 39.0, SBP: 90, MAP: 65, "
                    "DBP: 55, Resp: 26, EtCO2: 30."
                ),
            )

        readings = [values]

    return {
        "message": "Vital signs extracted. Review before analysis.",
        "filename": filename,
        "readings": readings,
        "vitals_found": sorted(
            {
                key
                for reading in readings
                for key in reading.keys()
            }
        ),
        "review_required": True,
        "prediction_ready": False,
    }
