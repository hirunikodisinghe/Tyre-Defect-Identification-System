import { useState } from "react";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("inspection");

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // IMAGE CHANGE
  // =========================================================

  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));

    setResult(null);
    setError("");
  };

  // =========================================================
  // RUN INSPECTION
  // =========================================================

  const analyzeImage = async () => {
    if (!image) {
      setError("Please select a tyre image first.");
      return;
    }

    const formData = new FormData();

    formData.append("image", image);

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://127.0.0.1:5005/predict",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Prediction failed."
        );
      }

      setResult(data);

      setActiveTab("analysis");
    } catch (err) {
      console.error(err);

      setError(
        "Unable to analyze the image. Make sure the Flask backend is running on port 5005."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESET
  // =========================================================

  const resetInspection = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError("");
    setActiveTab("inspection");
  };

  // =========================================================
  // MAIN APP
  // =========================================================

  return (
    <div className="app">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            AI
          </div>

          <div>
            <h2>TyreVision</h2>

            <p>
              AI Inspection Platform
            </p>
          </div>
        </div>

        <div className="sidebar-menu">
          <SidebarButton
            title="New Inspection"
            active={
              activeTab === "inspection"
            }
            onClick={() =>
              setActiveTab("inspection")
            }
          />

          <SidebarButton
            title="AI Analysis"
            active={
              activeTab === "analysis"
            }
            onClick={() =>
              setActiveTab("analysis")
            }
          />

          <SidebarButton
            title="Explainable AI"
            active={
              activeTab === "xai"
            }
            onClick={() =>
              setActiveTab("xai")
            }
          />

          <SidebarButton
            title="Standards"
            active={
              activeTab === "standards"
            }
            onClick={() =>
              setActiveTab("standards")
            }
          />

          <SidebarButton
            title="Model Information"
            active={
              activeTab === "model"
            }
            onClick={() =>
              setActiveTab("model")
            }
          />
        </div>

        <div className="sidebar-bottom">
          <p>
            EfficientNet-B0
          </p>

          <span>
            ● Model Active
          </span>
        </div>
      </aside>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <main className="content">
        {activeTab === "inspection" && (
          <InspectionPage
            preview={preview}
            loading={loading}
            error={error}
            result={result}
            handleImageChange={
              handleImageChange
            }
            analyzeImage={analyzeImage}
          />
        )}

        {activeTab === "analysis" && (
          <AnalysisPage
            result={result}
            preview={preview}
          />
        )}

        {activeTab === "xai" && (
          <XAIPage
            result={result}
            preview={preview}
          />
        )}

        {activeTab === "standards" && (
          <StandardsPage
            result={result}
          />
        )}

        {activeTab === "model" && (
          <ModelPage />
        )}

        {result && (
          <div className="footer-actions">
            <button
              className="button-secondary"
              onClick={resetInspection}
            >
              New Inspection
            </button>

            <button
              className="button-primary"
              onClick={() =>
                window.print()
              }
            >
              Print Result
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ===========================================================
// SIDEBAR BUTTON
// ===========================================================

function SidebarButton({
  title,
  active,
  onClick,
}) {
  return (
    <button
      className={`sidebar-button ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      {title}
    </button>
  );
}

// ===========================================================
// PAGE HEADER
// ===========================================================

function PageHeader({
  smallTitle,
  title,
  description,
}) {
  return (
    <div className="page-header">
      <div>
        <p className="small-title">
          {smallTitle}
        </p>

        <h1>
          {title}
        </h1>

        <p className="page-description">
          {description}
        </p>
      </div>

      <div className="online-badge">
        <span></span>
        AI Model Online
      </div>
    </div>
  );
}

// ===========================================================
// NEW INSPECTION PAGE
// ===========================================================

function InspectionPage({
  preview,
  loading,
  error,
  result,
  handleImageChange,
  analyzeImage,
}) {
  return (
    <>
      <PageHeader
        smallTitle="AI TYRE INSPECTION"
        title="Tyre Defect Identification System"
        description="AI-powered tyre defect classification, explainability and standards-aware inspection."
      />

      <div className="two-column">
        {/* UPLOAD */}

        <div className="card">
          <CardHeader
            number="01"
            title="Upload Tyre Image"
            description="Select a clear industrial tyre image."
          />

          <input
            id="imageInput"
            type="file"
            accept="image/*"
            onChange={
              handleImageChange
            }
          />

          {!preview ? (
            <label
              htmlFor="imageInput"
              className="upload-area"
            >
              <div className="upload-symbol">
                +
              </div>

              <h3>
                Select tyre image
              </h3>

              <p>
                JPG, JPEG or PNG
              </p>

              <div className="browse-button">
                Browse Image
              </div>
            </label>
          ) : (
            <div className="image-preview">
              <img
                src={preview}
                alt="Tyre preview"
              />

              <label
                htmlFor="imageInput"
                className="change-image-button"
              >
                Change Image
              </label>
            </div>
          )}

          <button
            className="run-button"
            disabled={loading}
            onClick={analyzeImage}
          >
            {loading
              ? "AI Analysis in Progress..."
              : "Run AI Inspection"}
          </button>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}
        </div>

        {/* QUALITY */}

        <div className="card">
          <CardHeader
            number="02"
            title={
              result
                ? "Image Quality"
                : "Inspection Workflow"
            }
            description={
              result
                ? "Automatic inspection readiness check."
                : "AI-based inspection process."
            }
          />

          {!result ? (
            <div className="workflow">
              <WorkflowItem
                number="01"
                text="Upload tyre image"
              />

              <WorkflowItem
                number="02"
                text="Image quality validation"
              />

              <WorkflowItem
                number="03"
                text="Defect classification"
              />

              <WorkflowItem
                number="04"
                text="Explainable AI analysis"
              />

              <WorkflowItem
                number="05"
                text="Standards-aware guidance"
              />
            </div>
          ) : (
            <>
              <InfoRow
                label="Resolution"
                value={
                  result.image_quality
                    ?.resolution
                }
              />

              <InfoRow
                label="Brightness"
                value={
                  result.image_quality
                    ?.brightness
                }
              />

              <InfoRow
                label="Sharpness"
                value={
                  result.image_quality
                    ?.sharpness
                }
              />

              <InfoRow
                label="Image Size"
                value={
                  result.image_quality
                    ? `${result.image_quality.width} × ${result.image_quality.height}`
                    : "-"
                }
              />

              <div className="quality-status">
                <span>
                  Inspection Readiness
                </span>

                <strong>
                  {
                    result.image_quality
                      ?.overall
                  }
                </strong>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===========================================================
// ANALYSIS PAGE
// ===========================================================

function AnalysisPage({
  result,
  preview,
}) {
  return (
    <>
      <PageHeader
        smallTitle="AI ANALYSIS"
        title="Prediction Analysis"
        description="Review the AI prediction, confidence, severity and prediction distribution."
      />

      {!result ? (
        <EmptyPage />
      ) : (
        <>
          <div className="two-column">
            <div className="card">
              <h2>
                Analyzed Image
              </h2>

              <img
                className="analysis-image"
                src={preview}
                alt="Analyzed tyre"
              />
            </div>

            <div className="card">
              <p className="small-title">
                PRIMARY PREDICTION
              </p>

              <div className="primary-result">
                {formatName(
                  result.prediction
                )}
              </div>

              <InfoRow
                label="Confidence"
                value={`${result.confidence}%`}
              />

              <InfoRow
                label="Severity"
                value={result.severity}
              />

              <InfoRow
                label="AI Status"
                value={
                  result.confidence_status
                }
              />

              <div className="confidence-wrapper">
                <div className="confidence-title">
                  <span>
                    Confidence
                  </span>

                  <strong>
                    {result.confidence}%
                  </strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-value"
                    style={{
                      width: `${result.confidence}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card section-space">
            <h2>
              Prediction Breakdown
            </h2>

            <p className="muted">
              Top model predictions for
              the analyzed tyre image.
            </p>

            {result.top_predictions?.map(
              (item, index) => (
                <div
                  className="prediction-row"
                  key={index}
                >
                  <div className="prediction-name">
                    <span>
                      {index + 1}
                    </span>

                    <strong>
                      {formatName(
                        item.class
                      )}
                    </strong>
                  </div>

                  <div className="prediction-value">
                    <div className="mini-progress">
                      <div
                        style={{
                          width: `${item.confidence}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {
                        item.confidence
                      }
                      %
                    </strong>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </>
  );
}

// ===========================================================
// XAI PAGE
// ===========================================================

function XAIPage({
  result,
  preview,
}) {
  return (
    <>
      <PageHeader
        smallTitle="EXPLAINABLE AI"
        title="AI Decision Explanation"
        description="Understand which regions influenced the AI prediction."
      />

      {!result?.xai ? (
        <EmptyPage
          text="Run an inspection first to generate XAI results."
        />
      ) : (
        <>
          <div className="two-column">
            <div className="card">
              <h2>
                Original Image
              </h2>

              <img
                className="xai-image"
                src={preview}
                alt="Original tyre"
              />
            </div>

            <div className="card">
              <div className="xai-header">
                <h2>
                  AI Attention Map
                </h2>

                <span>
                  {
                    result.xai
                      .method
                  }
                </span>
              </div>

              <img
                className="xai-image"
                src={`data:image/jpeg;base64,${result.xai.heatmap}`}
                alt="Grad-CAM"
              />
            </div>
          </div>

          <div className="card section-space">
            <h2>
              XAI Analysis
            </h2>

            <div className="metric-grid">
              <MetricBox
                title="Method"
                value={
                  result.xai.method
                }
              />

              <MetricBox
                title="Attention Region"
                value={
                  result.xai
                    .attention_region
                }
              />

              <MetricBox
                title="Activation Area"
                value={`${result.xai.attention_area_percentage}%`}
              />

              <MetricBox
                title="Prediction"
                value={formatName(
                  result.prediction
                )}
              />
            </div>

            <div className="explanation">
              <h3>
                Why did the AI make this prediction?
              </h3>

              <p>
                {
                  result.xai
                    .explanation
                }
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ===========================================================
// STANDARDS PAGE
// ===========================================================

function StandardsPage({
  result,
}) {
  const standard =
    result?.standard_information;

  return (
    <>
      <PageHeader
        smallTitle="STANDARDS-AWARE XAI"
        title="Inspection Standards"
        description="Inspection guidance associated with the detected tyre condition."
      />

      {!standard ? (
        <EmptyPage
          text="Run an inspection first to retrieve standards-aware guidance."
        />
      ) : (
        <>
          <div className="three-column">
            <MetricBox
              title="Tyre Component"
              value={
                standard.component
              }
            />

            <MetricBox
              title="Detected Condition"
              value={
                standard.condition
              }
            />

            <MetricBox
              title="Inspection Decision"
              value={
                standard.decision
              }
            />
          </div>

          <div className="card section-space">
            <h2>
              Relevant Inspection Checks
            </h2>

            {standard.inspection_checks?.map(
              (check, index) => (
                <div
                  className="standard-check"
                  key={index}
                >
                  <span>
                    ✓
                  </span>

                  <p>
                    {check}
                  </p>
                </div>
              )
            )}
          </div>

          <div className="card section-space">
            <h2>
              Standards-Based Guidance
            </h2>

            <div className="guidance-box">
              {
                standard.guidance
              }
            </div>

            <p className="reference">
              <strong>
                Reference:
              </strong>{" "}
              {
                standard.reference
              }
            </p>

            <p className="warning-text">
              Use verified company or
              published standards before
              operational deployment.
            </p>
          </div>
        </>
      )}
    </>
  );
}

// ===========================================================
// MODEL PAGE
// ===========================================================

function ModelPage() {
  const classes = [
    "Abnormal Wear",
    "Bead Damage",
    "Bulge",
    "Cut",
    "Shoulder Crack",
    "Sidewall Crack",
    "Sidewall Damage",
    "Tire Burst",
    "Tread Chunking",
    "Tread Damage",
    "Tread Separation",
    "No Defect",
  ];

  return (
    <>
      <PageHeader
        smallTitle="MODEL INFORMATION"
        title="AI Model Details"
        description="Technical details of the deployed tyre defect identification model."
      />

      <div className="three-column">
        <MetricBox
          title="Architecture"
          value="EfficientNet-B0"
        />

        <MetricBox
          title="Framework"
          value="PyTorch"
        />

        <MetricBox
          title="Classes"
          value="12"
        />

        <MetricBox
          title="Input Size"
          value="224 × 224"
        />

        <MetricBox
          title="XAI Method"
          value="Grad-CAM"
        />

        <MetricBox
          title="Backend"
          value="Flask"
        />
      </div>

      <div className="card section-space">
        <h2>
          Supported Defect Classes
        </h2>

        <div className="class-list">
          {classes.map(
            (item, index) => (
              <div
                className="class-item"
                key={item}
              >
                <span>
                  {String(
                    index + 1
                  ).padStart(
                    2,
                    "0"
                  )}
                </span>

                {item}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ===========================================================
// COMPONENTS
// ===========================================================

function CardHeader({
  number,
  title,
  description,
}) {
  return (
    <div className="card-header">
      <span>
        {number}
      </span>

      <div>
        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}

function WorkflowItem({
  number,
  text,
}) {
  return (
    <div className="workflow-item">
      <span>
        {number}
      </span>

      <strong>
        {text}
      </strong>
    </div>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="info-row">
      <span>
        {label}
      </span>

      <strong>
        {value || "-"}
      </strong>
    </div>
  );
}

function MetricBox({
  title,
  value,
}) {
  return (
    <div className="metric-box">
      <p>
        {title}
      </p>

      <strong>
        {value || "-"}
      </strong>
    </div>
  );
}

function EmptyPage({
  text = "Run a tyre inspection first from the New Inspection page.",
}) {
  return (
    <div className="card empty-page">
      <div className="empty-icon">
        AI
      </div>

      <h2>
        No Inspection Result
      </h2>

      <p>
        {text}
      </p>
    </div>
  );
}

function formatName(name) {
  return name
    ? name.replaceAll("_", " ")
    : "";
}

export default App;