import os
import io
import json
import base64

import cv2  # type: ignore[reportMissingImports]
import numpy as np  # type: ignore[reportMissingImports]

from flask import Flask, request, jsonify  # type: ignore[reportMissingImports]
from flask_cors import CORS  # type: ignore[reportMissingImports]

import torch  # type: ignore[reportMissingImports]
import torch.nn as nn  # type: ignore[reportMissingImports]
from torchvision import models, transforms  # type: ignore[reportMissingImports]

from PIL import Image

from pytorch_grad_cam import GradCAM  # type: ignore[reportMissingImports]
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget  # type: ignore[reportMissingImports]
from pytorch_grad_cam.utils.image import show_cam_on_image  # type: ignore[reportMissingImports]

from pathlib import Path

# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)
CORS(app)


# ============================================================
# PATHS / SETTINGS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

# Active production model. Keep this file in the same folder as app.py.
MODEL_PATH = BASE_DIR / "best_tire_defect_model_4.pth"

# Prefer a local class_names.txt for a portable deployment.
# If it is not present yet, keep compatibility with your existing training-project file.
LOCAL_CLASS_NAMES_PATH = BASE_DIR / "class_names.txt"
OLD_CLASS_NAMES_PATH = Path(
    r"E:\Hiruni\TireDefectProject\class_names.txt"
)

CLASS_NAMES_PATH = (
    LOCAL_CLASS_NAMES_PATH
    if LOCAL_CLASS_NAMES_PATH.exists()
    else OLD_CLASS_NAMES_PATH
)

# Support either standard.json or standards.json in the backend folder.
STANDARD_CANDIDATES = [
    BASE_DIR / "standards.json",
    BASE_DIR / "standard.json",
]

STANDARDS_PATH = next(
    (path for path in STANDARD_CANDIDATES if path.exists()),
    STANDARD_CANDIDATES[0],
)

PORT = 5005


# ============================================================
# CLASSES
#
# Load class names directly from class_names.txt.
# This keeps the class order identical to training.
# ============================================================

if not CLASS_NAMES_PATH.exists():

    raise FileNotFoundError(
        f"Class names file does not exist:\n{CLASS_NAMES_PATH}"
    )


with CLASS_NAMES_PATH.open(
    "r",
    encoding="utf-8"
) as file:

    CLASSES = [
        line.strip()
        for line in file
        if line.strip()
    ]


if not CLASSES:

    raise ValueError(
        f"No class names were found in:\n{CLASS_NAMES_PATH}"
    )


NUM_CLASSES = len(CLASSES)


# ============================================================
# STANDARD INFORMATION
# ============================================================

if STANDARDS_PATH.exists():

    with open(
        STANDARDS_PATH,
        "r",
        encoding="utf-8"
    ) as file:

        STANDARD_INFO = json.load(file)

else:

    print(
        "WARNING: standards.json was not found."
    )

    STANDARD_INFO = {}


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)

print("=" * 70)
print("TYREVISION AI INSPECTION API")
print("=" * 70)
print("Device:", device)
print("Model:", MODEL_PATH)
print("Classes:", NUM_CLASSES)
print("=" * 70)


# ============================================================
# CHECK MODEL FILE
# ============================================================

if not MODEL_PATH.exists():

    raise FileNotFoundError(
        f"Model file does not exist:\n{MODEL_PATH}"
    )


# ============================================================
# BUILD MODEL
# ============================================================

model = models.efficientnet_b0(
    weights=None
)

model.classifier[1] = nn.Linear(
    model.classifier[1].in_features,
    NUM_CLASSES
)


# ============================================================
# LOAD MODEL
# ============================================================

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device,
    weights_only=True
)


if isinstance(checkpoint, dict):

    if "model_state_dict" in checkpoint:

        state_dict = checkpoint[
            "model_state_dict"
        ]

    elif "state_dict" in checkpoint:

        state_dict = checkpoint[
            "state_dict"
        ]

    elif (
        "model" in checkpoint
        and isinstance(
            checkpoint["model"],
            dict
        )
    ):

        state_dict = checkpoint[
            "model"
        ]

    else:

        state_dict = checkpoint

else:

    state_dict = checkpoint


cleaned_state_dict = {}

for key, value in state_dict.items():

    new_key = key

    if key.startswith("module."):

        new_key = key.replace(
            "module.",
            "",
            1
        )

    cleaned_state_dict[new_key] = value


model.load_state_dict(
    cleaned_state_dict,
    strict=True
)

model = model.to(device)

model.eval()

print("Model loaded successfully.")


# ============================================================
# IMAGE TRANSFORM
#
# Match this with your original validation/test preprocessing.
# ============================================================

transform = transforms.Compose([

    transforms.Resize(
        (224, 224)
    ),

    transforms.ToTensor(),

    transforms.Normalize(

        mean=[
            0.485,
            0.456,
            0.406
        ],

        std=[
            0.229,
            0.224,
            0.225
        ]
    )
])


# ============================================================
# IMAGE QUALITY
# ============================================================

def check_image_quality(image_bytes):

    array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    cv_image = cv2.imdecode(
        array,
        cv2.IMREAD_COLOR
    )

    if cv_image is None:

        return {
            "resolution": "Invalid",
            "brightness": "Invalid",
            "sharpness": "Invalid",
            "overall": "Poor",
            "quality_score": 0
        }


    height, width = cv_image.shape[:2]


    # --------------------------------------------------------
    # Resolution
    # --------------------------------------------------------

    if width >= 1000 and height >= 700:

        resolution = "Excellent"
        resolution_score = 100

    elif width >= 600 and height >= 400:

        resolution = "Good"
        resolution_score = 85

    elif width >= 400 and height >= 300:

        resolution = "Acceptable"
        resolution_score = 70

    else:

        resolution = "Low"
        resolution_score = 40


    # --------------------------------------------------------
    # Brightness
    # --------------------------------------------------------

    gray = cv2.cvtColor(
        cv_image,
        cv2.COLOR_BGR2GRAY
    )

    brightness_value = float(
        np.mean(gray)
    )


    if brightness_value < 40:

        brightness = "Too Dark"
        brightness_score = 35

    elif brightness_value < 65:

        brightness = "Slightly Dark"
        brightness_score = 70

    elif brightness_value > 220:

        brightness = "Too Bright"
        brightness_score = 35

    elif brightness_value > 200:

        brightness = "Slightly Bright"
        brightness_score = 70

    else:

        brightness = "Good"
        brightness_score = 100


    # --------------------------------------------------------
    # Sharpness
    # --------------------------------------------------------

    sharpness_value = float(

        cv2.Laplacian(
            gray,
            cv2.CV_64F
        ).var()
    )


    if sharpness_value < 40:

        sharpness = "Blurry"
        sharpness_score = 35

    elif sharpness_value < 100:

        sharpness = "Acceptable"
        sharpness_score = 70

    else:

        sharpness = "Good"
        sharpness_score = 100


    # --------------------------------------------------------
    # Overall quality score
    # --------------------------------------------------------

    quality_score = (

        resolution_score * 0.30
        + brightness_score * 0.30
        + sharpness_score * 0.40
    )


    if quality_score >= 80:

        overall = "Ready for Analysis"

    elif quality_score >= 60:

        overall = "Usable - Review Recommended"

    else:

        overall = "Retake Image Recommended"


    return {

        "width":
            width,

        "height":
            height,

        "resolution":
            resolution,

        "brightness":
            brightness,

        "sharpness":
            sharpness,

        "brightness_value":
            round(
                brightness_value,
                2
            ),

        "sharpness_value":
            round(
                sharpness_value,
                2
            ),

        "quality_score":
            round(
                quality_score,
                2
            ),

        "overall":
            overall
    }


# ============================================================
# SEVERITY
#
# Rule based at this stage.
# ============================================================

def calculate_severity(
    defect,
    confidence
):

    if defect == "noDefect":

        return "None"


    critical_defects = [
        "Tire_Burst",
        "Tread_Separation"
    ]


    high_defects = [
        "Bulge",
        "Sidewall_Crack",
        "Sidewall_Damage"
    ]


    if defect in critical_defects:

        if confidence >= 75:

            return "Critical"

        return "Review Required"


    if defect in high_defects:

        if confidence >= 85:

            return "High"

        if confidence >= 65:

            return "Medium"

        return "Review Required"


    if confidence >= 90:

        return "Medium"

    if confidence >= 70:

        return "Low"

    return "Review Required"


# ============================================================
# ADVANCED UNCERTAINTY
# ============================================================

def calculate_uncertainty(
    sorted_probabilities
):

    if len(sorted_probabilities) < 2:

        return {
            "status": "Unknown",
            "prediction_margin": 0,
            "uncertainty_score": 100
        }


    top1 = sorted_probabilities[0]

    top2 = sorted_probabilities[1]


    margin = top1 - top2


    # Low margin means classes are competing.
    uncertainty_score = max(
        0,
        min(
            100,
            100 - margin
        )
    )


    if top1 < 60:

        status = "High Uncertainty"

    elif margin < 10:

        status = "High Uncertainty"

    elif margin < 25:

        status = "Moderate Uncertainty"

    else:

        status = "Low Uncertainty"


    return {

        "status":
            status,

        "prediction_margin":
            round(
                margin,
                2
            ),

        "uncertainty_score":
            round(
                uncertainty_score,
                2
            )
    }


# ============================================================
# CONFIDENCE STATUS
# ============================================================

def calculate_confidence_status(
    confidence,
    uncertainty_status
):

    if uncertainty_status == "High Uncertainty":

        return "Manual Inspection Required"


    if confidence >= 90:

        return "High Confidence"


    if confidence >= 70:

        return "Review Recommended"


    return "Manual Inspection Required"


# ============================================================
# TYRE HEALTH SCORE
#
# This is a project-defined decision-support score,
# not an industry certification.
# ============================================================

def calculate_health_score(
    defect,
    severity,
    confidence,
    image_quality_score,
    uncertainty_status
):

    score = 100.0


    severity_penalty = {

        "None": 0,
        "Low": 15,
        "Medium": 30,
        "High": 50,
        "Critical": 70,
        "Review Required": 40

    }


    score -= severity_penalty.get(
        severity,
        30
    )


    # Confidence penalty only when a defect is predicted.
    if defect != "noDefect":

        if confidence < 70:

            score -= 10

        elif confidence < 85:

            score -= 5


    # Poor image quality reduces reliability.
    if image_quality_score < 60:

        score -= 10

    elif image_quality_score < 80:

        score -= 5


    if uncertainty_status == "High Uncertainty":

        score -= 10

    elif uncertainty_status == "Moderate Uncertainty":

        score -= 5


    score = max(
        0,
        min(
            100,
            score
        )
    )


    if score >= 85:

        health_status = "Good"

    elif score >= 65:

        health_status = "Monitor"

    elif score >= 40:

        health_status = "Attention Required"

    else:

        health_status = "Critical Attention"


    return {

        "score":
            round(
                score,
                1
            ),

        "status":
            health_status
    }


# ============================================================
# GRAD-CAM
# ============================================================

def create_gradcam(
    pil_image,
    input_tensor,
    predicted_index
):

    target_layers = [
        model.features[-1]
    ]


    cam = GradCAM(

        model=model,

        target_layers=target_layers
    )


    targets = [

        ClassifierOutputTarget(
            predicted_index
        )

    ]


    grayscale_cam = cam(

        input_tensor=input_tensor,

        targets=targets

    )[0]


    original_image = pil_image.resize(
        (224, 224)
    )


    original_array = np.array(
        original_image
    ).astype(
        np.float32
    ) / 255.0


    visualization = show_cam_on_image(

        original_array,

        grayscale_cam,

        use_rgb=True
    )


    # --------------------------------------------------------
    # Strongest activation position
    # --------------------------------------------------------

    y, x = np.unravel_index(

        np.argmax(
            grayscale_cam
        ),

        grayscale_cam.shape
    )


    h, w = grayscale_cam.shape


    if x < w / 3:

        horizontal = "Left"

    elif x > w * 2 / 3:

        horizontal = "Right"

    else:

        horizontal = "Center"


    if y < h / 3:

        vertical = "Upper"

    elif y > h * 2 / 3:

        vertical = "Lower"

    else:

        vertical = "Middle"


    attention_region = (
        f"{vertical} {horizontal} region"
    )


    # --------------------------------------------------------
    # High activation area
    # --------------------------------------------------------

    threshold = (
        grayscale_cam.max()
        * 0.60
    )


    active_pixels = np.sum(

        grayscale_cam >= threshold

    )


    area_percentage = (

        active_pixels
        / grayscale_cam.size
        * 100
    )


    # --------------------------------------------------------
    # Encode image
    # --------------------------------------------------------

    bgr = cv2.cvtColor(

        visualization,

        cv2.COLOR_RGB2BGR
    )


    success, buffer = cv2.imencode(

        ".jpg",

        bgr
    )


    if not success:

        raise RuntimeError(
            "Unable to generate Grad-CAM image."
        )


    encoded = base64.b64encode(

        buffer

    ).decode(
        "utf-8"
    )


    return {

        "heatmap":
            encoded,

        "attention_region":
            attention_region,

        "attention_area_percentage":
            round(
                area_percentage,
                2
            )
    }


# ============================================================
# XAI RELIABILITY SCORE
#
# Combines:
# - model confidence
# - image quality
# - prediction margin
# ============================================================

def calculate_xai_reliability(
    confidence,
    image_quality_score,
    prediction_margin
):

    margin_score = min(
        100,
        prediction_margin * 2
    )


    score = (

        confidence * 0.45
        + image_quality_score * 0.30
        + margin_score * 0.25
    )


    score = max(
        0,
        min(
            100,
            score
        )
    )


    if score >= 85:

        status = "High"

    elif score >= 65:

        status = "Moderate"

    else:

        status = "Low"


    return {

        "score":
            round(
                score,
                2
            ),

        "status":
            status
    }


# ============================================================
# XAI EXPLANATION
# ============================================================

def create_xai_explanation(
    defect,
    confidence,
    gradcam,
    uncertainty
):

    readable_defect = defect.replace(
        "_",
        " "
    )


    return (

        f"The model predicted {readable_defect} "
        f"with {confidence:.2f}% confidence. "

        f"Grad-CAM shows the strongest model activation "
        f"in the {gradcam['attention_region']}. "

        f"The high-activation region covers approximately "
        f"{gradcam['attention_area_percentage']:.2f}% "
        f"of the generated Grad-CAM map. "

        f"The prediction margin between the two most likely "
        f"classes is {uncertainty['prediction_margin']:.2f} "
        f"percentage points, producing an uncertainty status "
        f"of {uncertainty['status']}."
    )


# ============================================================
# STANDARD LOOKUP
# ============================================================

def get_standard_information(
    defect
):

    return STANDARD_INFO.get(

        defect,

        {
            "component":
                "Not configured",

            "condition":
                defect.replace(
                    "_",
                    " "
                ),

            "inspection_checks":
                [],

            "reference":
                "No verified standard configured",

            "guidance":
                "Manual engineering inspection is recommended.",

            "decision":
                "Manual review required"
        }
    )


# ============================================================
# HOME
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def home():

    return jsonify({

        "success":
            True,

        "system":
            "TyreVision",

        "model":
            "EfficientNet-B0",

        "xai":
            "Grad-CAM",

        "classes":
            NUM_CLASSES,

        "device":
            str(device),

        "status":
            "online"
    })


# ============================================================
# HEALTH
# ============================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({
        "success": True,
        "status": "healthy",
        "model_loaded": True,
        "model": "EfficientNet-B0",
        "device": str(device),
        "classes": NUM_CLASSES
    })


# ============================================================
# PREDICT
# ============================================================

@app.route(
    "/predict",
    methods=["POST"]
)
def predict():

    try:

        # ----------------------------------------------------
        # Validate image
        # ----------------------------------------------------

        if "image" not in request.files:

            return jsonify({

                "success":
                    False,

                "error":
                    "No image uploaded."

            }), 400


        file = request.files[
            "image"
        ]


        if file.filename == "":

            return jsonify({

                "success":
                    False,

                "error":
                    "No image selected."

            }), 400


        image_bytes = file.read()


        try:

            pil_image = Image.open(

                io.BytesIO(
                    image_bytes
                )

            ).convert(
                "RGB"
            )

        except Exception:

            return jsonify({

                "success":
                    False,

                "error":
                    "Uploaded file is not a valid image."

            }), 400


        # ----------------------------------------------------
        # Image quality
        # ----------------------------------------------------

        quality = check_image_quality(
            image_bytes
        )


        # ----------------------------------------------------
        # Transform
        # ----------------------------------------------------

        input_tensor = transform(
            pil_image
        )


        input_tensor = input_tensor.unsqueeze(
            0
        ).to(
            device
        )


        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        with torch.inference_mode():

            outputs = model(
                input_tensor
            )


            probabilities = torch.softmax(

                outputs,

                dim=1
            )


        probability_values = (

            probabilities[0]
            .detach()
            .cpu()
            .numpy()
            * 100
        )


        sorted_indices = np.argsort(

            probability_values

        )[::-1]


        sorted_probabilities = [

            float(
                probability_values[index]
            )

            for index in sorted_indices
        ]


        predicted_index = int(
            sorted_indices[0]
        )


        predicted_class = CLASSES[
            predicted_index
        ]


        confidence = float(
            probability_values[
                predicted_index
            ]
        )


        # ----------------------------------------------------
        # Top predictions
        # ----------------------------------------------------

        top_predictions = []


        for index in sorted_indices[:3]:

            top_predictions.append({

                "class":
                    CLASSES[
                        int(index)
                    ],

                "confidence":
                    round(
                        float(
                            probability_values[
                                index
                            ]
                        ),
                        2
                    )
            })


        # ----------------------------------------------------
        # Uncertainty
        # ----------------------------------------------------

        uncertainty = calculate_uncertainty(
            sorted_probabilities
        )


        confidence_status = (
            calculate_confidence_status(

                confidence,

                uncertainty[
                    "status"
                ]
            )
        )


        # ----------------------------------------------------
        # Severity
        # ----------------------------------------------------

        severity = calculate_severity(

            predicted_class,

            confidence
        )


        # ----------------------------------------------------
        # Health score
        # ----------------------------------------------------

        health = calculate_health_score(

            predicted_class,

            severity,

            confidence,

            quality.get(
                "quality_score",
                0
            ),

            uncertainty[
                "status"
            ]
        )


        # ----------------------------------------------------
        # Grad-CAM
        # ----------------------------------------------------

        gradcam = create_gradcam(

            pil_image,

            input_tensor,

            predicted_index
        )


        # ----------------------------------------------------
        # XAI reliability
        # ----------------------------------------------------

        xai_reliability = (
            calculate_xai_reliability(

                confidence,

                quality.get(
                    "quality_score",
                    0
                ),

                uncertainty[
                    "prediction_margin"
                ]
            )
        )


        # ----------------------------------------------------
        # XAI explanation
        # ----------------------------------------------------

        explanation = create_xai_explanation(

            predicted_class,

            confidence,

            gradcam,

            uncertainty
        )


        # ----------------------------------------------------
        # Standards
        # ----------------------------------------------------

        standard = get_standard_information(
            predicted_class
        )


        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return jsonify({

            "success":
                True,

            "filename":
                file.filename,

            "prediction":
                predicted_class,

            "confidence":
                round(
                    confidence,
                    2
                ),

            "confidence_status":
                confidence_status,

            "severity":
                severity,

            "image_quality":
                quality,

            "top_predictions":
                top_predictions,

            "uncertainty": {

                "status":
                    uncertainty[
                        "status"
                    ],

                "prediction_margin":
                    uncertainty[
                        "prediction_margin"
                    ],

                "uncertainty_score":
                    uncertainty[
                        "uncertainty_score"
                    ]
            },

            "tyre_health": {

                "score":
                    health[
                        "score"
                    ],

                "status":
                    health[
                        "status"
                    ]
            },

            "xai": {

                "method":
                    "Grad-CAM",

                "heatmap":
                    gradcam[
                        "heatmap"
                    ],

                "attention_region":
                    gradcam[
                        "attention_region"
                    ],

                "attention_area_percentage":
                    gradcam[
                        "attention_area_percentage"
                    ],

                "reliability_score":
                    xai_reliability[
                        "score"
                    ],

                "reliability_status":
                    xai_reliability[
                        "status"
                    ],

                "explanation":
                    explanation
            },

            "standard_information":
                standard,

            "important_note":
                "Tyre Health Score, severity and XAI reliability "
                "are project decision-support metrics. They are "
                "not certified tyre serviceability criteria. "
                "Operational decisions should use verified "
                "engineering standards and qualified inspection."
        })


    except Exception as error:

        print(
            "Prediction error:",
            error
        )

        return jsonify({

            "success":
                False,

            "error":
                str(error)

        }), 500


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    print()
    print(
        f"TyreVision API: http://127.0.0.1:{PORT}"
    )
    print(
        f"Health check: http://127.0.0.1:{PORT}/health"
    )
    print()

    # Manual/development test only.
    # For permanent hosting use Waitress:
    # waitress-serve --host=0.0.0.0 --port=5005 app:app
    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=False
    )
