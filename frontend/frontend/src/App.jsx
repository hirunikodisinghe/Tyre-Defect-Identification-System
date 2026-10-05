import { useState } from "react";
import "./App.css";

const DEFECT_CLASSES = [
  "Abnormal_Wear",
  "Bead_Damage",
  "Bulge",
  "Cut",
  "Shoulder_Crack",
  "Sidewall_Crack",
  "Sidewall_Damage",
  "Tire_Burst",
  "Tread_Chunking",
  "Tread_Damage",
  "Tread_Separation",
  "noDefect",
];

function App() {
  const [activeTab, setActiveTab] =
    useState("inspection");

  const [image, setImage] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [result, setResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [humanReview, setHumanReview] =
    useState(null);

  const [correctClass, setCorrectClass] =
    useState("");

  // =========================================================
  // SELECT IMAGE
  // =========================================================

  const handleImageChange = (event) => {
    const file =
      event.target.files[0];

    if (!file) return;

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImage(file);

    setPreview(
      URL.createObjectURL(file)
    );

    setResult(null);
    setHumanReview(null);
    setCorrectClass("");
    setError("");
  };

  // =========================================================
  // RUN INSPECTION
  // =========================================================

  const analyzeImage = async () => {
    if (!image) {
      setError(
        "Please select a tyre image first."
      );
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "image",
      image
    );

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setHumanReview(null);

      const response =
        await fetch(
          "http://172.20.245.27:5005/predict",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Prediction failed."
        );
      }

      setResult(data);

      setActiveTab(
        "analysis"
      );
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
    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setImage(null);
    setPreview(null);
    setResult(null);
    setHumanReview(null);
    setCorrectClass("");
    setError("");

    setActiveTab(
      "inspection"
    );
  };

  // =========================================================
  // HUMAN REVIEW
  // =========================================================

  const markCorrect = () => {
    setHumanReview("correct");
    setCorrectClass("");
  };

  const markIncorrect = () => {
    setHumanReview("incorrect");
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const exportFeedbackCSV = () => {
    if (!result) return;

    const finalClass =
      humanReview === "incorrect"
        ? correctClass
        : result.prediction;

    const rows = [
      [
        "Image",
        "AI Prediction",
        "Confidence",
        "Severity",
        "Health Score",
        "Health Status",
        "Uncertainty",
        "Prediction Margin",
        "Human Review",
        "Final Class",
      ],

      [
        image?.name || "",
        result.prediction,
        result.confidence,
        result.severity,
        result.tyre_health?.score,
        result.tyre_health?.status,
        result.uncertainty?.status,
        result.uncertainty
          ?.prediction_margin,
        humanReview || "Not Reviewed",
        finalClass || "",
      ],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const safeValue =
              String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              );

            return `"${safeValue}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      `tyre_feedback_${Date.now()}.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url
    );
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={
          setActiveTab
        }
      />

      <main className="content">
        {activeTab ===
          "inspection" && (
          <InspectionPage
            preview={preview}
            result={result}
            loading={loading}
            error={error}
            handleImageChange={
              handleImageChange
            }
            analyzeImage={
              analyzeImage
            }
          />
        )}

        {activeTab ===
          "analysis" && (
          <AnalysisPage
            result={result}
            preview={preview}
          />
        )}

        {activeTab ===
          "health" && (
          <HealthPage
            result={result}
          />
        )}

        {activeTab ===
          "xai" && (
          <XAIPage
            result={result}
            preview={preview}
          />
        )}

        {activeTab ===
          "standards" && (
          <StandardsPage
            result={result}
          />
        )}

        {activeTab ===
          "review" && (
          <HumanReviewPage
            result={result}
            humanReview={
              humanReview
            }
            correctClass={
              correctClass
            }
            setCorrectClass={
              setCorrectClass
            }
            markCorrect={
              markCorrect
            }
            markIncorrect={
              markIncorrect
            }
            exportFeedbackCSV={
              exportFeedbackCSV
            }
          />
        )}

        {activeTab ===
          "model" && (
          <ModelPage />
        )}

        {result && (
          <div className="footer-actions">
            <button
              className="button-secondary"
              onClick={
                resetInspection
              }
            >
              New Inspection
            </button>

            <button
              className="button-primary"
              onClick={() =>
                window.print()
              }
            >
              Print Report
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ===========================================================
// SIDEBAR
// ===========================================================

function Sidebar({
  activeTab,
  setActiveTab,
}) {
  const tabs = [
    [
      "inspection",
      "New Inspection",
    ],
    [
      "analysis",
      "AI Analysis",
    ],
    [
      "health",
      "Tyre Health",
    ],
    [
      "xai",
      "Explainable AI",
    ],
    [
      "standards",
      "Standards",
    ],
    [
      "review",
      "Human Review",
    ],
    [
      "model",
      "Model Information",
    ],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          AI
        </div>

        <div>
          <h2>
            TyreVision
          </h2>

          <p>
            AI Inspection Platform
          </p>
        </div>
      </div>

      <div className="sidebar-menu">
        {tabs.map(
          ([key, label]) => (
            <button
              key={key}
              className={`sidebar-button ${
                activeTab === key
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveTab(
                  key
                )
              }
            >
              {label}
            </button>
          )
        )}
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
  );
}

// ===========================================================
// HEADER
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
        <span />
        AI Model Online
      </div>
    </div>
  );
}

// ===========================================================
// INSPECTION
// ===========================================================

function InspectionPage({
  preview,
  result,
  loading,
  error,
  handleImageChange,
  analyzeImage,
}) {
  return (
    <>
      <PageHeader
        smallTitle="AI TYRE INSPECTION"
        title="Tyre Defect Identification System"
        description="Upload an industrial tyre image to perform AI classification, XAI analysis and standards-aware inspection."
      />

      <div className="two-column">
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
            onClick={
              analyzeImage
            }
            disabled={loading}
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
                ? "Automatic image readiness evaluation."
                : "TyreVision inspection process."
            }
          />

          {!result ? (
            <div className="workflow">
              <WorkflowItem
                number="01"
                text="Image quality validation"
              />

              <WorkflowItem
                number="02"
                text="Defect classification"
              />

              <WorkflowItem
                number="03"
                text="Uncertainty analysis"
              />

              <WorkflowItem
                number="04"
                text="Tyre Health Score"
              />

              <WorkflowItem
                number="05"
                text="Grad-CAM XAI"
              />

              <WorkflowItem
                number="06"
                text="Standards guidance"
              />

              <WorkflowItem
                number="07"
                text="Human verification"
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
                value={`${result.image_quality?.width} × ${result.image_quality?.height}`}
              />

              <InfoRow
                label="Quality Score"
                value={`${result.image_quality?.quality_score}/100`}
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
// ANALYSIS
// ===========================================================

function AnalysisPage({
  result,
  preview,
}) {
  if (!result) {
    return (
      <>
        <PageHeader
          smallTitle="AI ANALYSIS"
          title="Prediction Analysis"
          description="Review AI prediction results."
        />

        <EmptyPage />
      </>
    );
  }

  return (
    <>
      <PageHeader
        smallTitle="AI ANALYSIS"
        title="Prediction Analysis"
        description="Review the predicted defect, confidence, severity and uncertainty."
      />

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
            value={
              result.severity
            }
          />

          <InfoRow
            label="AI Status"
            value={
              result.confidence_status
            }
          />

          <InfoRow
            label="Uncertainty"
            value={
              result.uncertainty
                ?.status
            }
          />

          <InfoRow
            label="Prediction Margin"
            value={`${result.uncertainty?.prediction_margin}%`}
          />

          <Progress
            value={
              result.confidence
            }
          />
        </div>
      </div>

      <div className="card section-space">
        <h2>
          Prediction Breakdown
        </h2>

        {result.top_predictions?.map(
          (item, index) => (
            <PredictionRow
              key={item.class}
              index={index}
              item={item}
            />
          )
        )}
      </div>
    </>
  );
}

// ===========================================================
// HEALTH PAGE
// ===========================================================

function HealthPage({
  result,
}) {
  return (
    <>
      <PageHeader
        smallTitle="TYRE HEALTH"
        title="Tyre Health Assessment"
        description="A decision-support score combining the current AI inspection outputs."
      />

      {!result ? (
        <EmptyPage />
      ) : (
        <>
          <div className="health-layout">
            <div className="health-score-card">
              <p>
                TYRE HEALTH SCORE
              </p>

              <div className="health-score">
                {
                  result.tyre_health
                    ?.score
                }
              </div>

              <span>
                / 100
              </span>

              <strong>
                {
                  result.tyre_health
                    ?.status
                }
              </strong>
            </div>

            <div className="card">
              <h2>
                Assessment Factors
              </h2>

              <InfoRow
                label="Detected Defect"
                value={formatName(
                  result.prediction
                )}
              />

              <InfoRow
                label="Severity"
                value={
                  result.severity
                }
              />

              <InfoRow
                label="Model Confidence"
                value={`${result.confidence}%`}
              />

              <InfoRow
                label="Image Quality"
                value={`${result.image_quality?.quality_score}/100`}
              />

              <InfoRow
                label="Uncertainty"
                value={
                  result.uncertainty
                    ?.status
                }
              />
            </div>
          </div>

          <div className="info-note">
            The Tyre Health Score is a
            project-defined decision-support
            metric and is not an industry
            certification or replacement for
            engineering inspection.
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
        description="Visualize which image regions influenced the neural network prediction."
      />

      {!result?.xai ? (
        <EmptyPage />
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
              Explainability Metrics
            </h2>

            <div className="metric-grid">
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
                title="XAI Reliability"
                value={`${result.xai.reliability_score}/100`}
              />

              <MetricBox
                title="Reliability Level"
                value={
                  result.xai
                    .reliability_status
                }
              />
            </div>

            <div className="explanation">
              <h3>
                AI Explanation
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
// STANDARDS
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
        description="Inspection guidance associated with the AI-detected condition."
      />

      {!standard ? (
        <EmptyPage />
      ) : (
        <>
          <div className="three-column">
            <MetricBox
              title="Component"
              value={
                standard.component
              }
            />

            <MetricBox
              title="Condition"
              value={
                standard.condition
              }
            />

            <MetricBox
              title="Decision"
              value={
                standard.decision
              }
            />
          </div>

          <div className="card section-space">
            <h2>
              Inspection Checks
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
              Guidance
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
          </div>
        </>
      )}
    </>
  );
}

// ===========================================================
// HUMAN REVIEW
// ===========================================================

function HumanReviewPage({
  result,
  humanReview,
  correctClass,
  setCorrectClass,
  markCorrect,
  markIncorrect,
  exportFeedbackCSV,
}) {
  return (
    <>
      <PageHeader
        smallTitle="HUMAN-IN-THE-LOOP"
        title="Inspector Verification"
        description="Verify the AI output and capture feedback for future model improvement."
      />

      {!result ? (
        <EmptyPage />
      ) : (
        <div className="card">
          <h2>
            AI Prediction
          </h2>

          <div className="review-prediction">
            {formatName(
              result.prediction
            )}

            <span>
              {result.confidence}%
            </span>
          </div>

          <p className="review-question">
            Is this AI prediction correct?
          </p>

          <div className="review-buttons">
            <button
              className={`review-correct ${
                humanReview ===
                "correct"
                  ? "selected"
                  : ""
              }`}
              onClick={
                markCorrect
              }
            >
              Correct
            </button>

            <button
              className={`review-incorrect ${
                humanReview ===
                "incorrect"
                  ? "selected"
                  : ""
              }`}
              onClick={
                markIncorrect
              }
            >
              Incorrect
            </button>
          </div>

          {humanReview ===
            "incorrect" && (
            <div className="correction-area">
              <label>
                Select the actual defect:
              </label>

              <select
                value={
                  correctClass
                }
                onChange={(event) =>
                  setCorrectClass(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  Select defect
                </option>

                {DEFECT_CLASSES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {formatName(
                        item
                      )}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {humanReview && (
            <div className="feedback-status">
              Human review recorded for
              this session.
            </div>
          )}

          <button
            className="export-button"
            disabled={
              !humanReview ||
              (humanReview ===
                "incorrect" &&
                !correctClass)
            }
            onClick={
              exportFeedbackCSV
            }
          >
            Export Feedback CSV
          </button>
        </div>
      )}
    </>
  );
}

// ===========================================================
// MODEL PAGE
// ===========================================================

function ModelPage() {
  return (
    <>
      <PageHeader
        smallTitle="MODEL INFORMATION"
        title="AI Model Details"
        description="Technical overview of the deployed tyre defect classification system."
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
          title="Defect Classes"
          value="12"
        />

        <MetricBox
          title="Input Size"
          value="224 × 224"
        />

        <MetricBox
          title="Explainability"
          value="Grad-CAM"
        />

        <MetricBox
          title="API"
          value="Flask"
        />
      </div>

      <div className="card section-space">
        <h2>
          Supported Classes
        </h2>

        <div className="class-list">
          {DEFECT_CLASSES.map(
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

                {formatName(
                  item
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}

// ===========================================================
// HELPERS
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

function PredictionRow({
  index,
  item,
}) {
  return (
    <div className="prediction-row">
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
              width:
                `${item.confidence}%`,
            }}
          />
        </div>

        <strong>
          {item.confidence}%
        </strong>
      </div>
    </div>
  );
}

function Progress({
  value,
}) {
  return (
    <div className="confidence-wrapper">
      <div className="confidence-title">
        <span>
          Prediction Confidence
        </span>

        <strong>
          {value}%
        </strong>
      </div>

      <div className="progress-track">
        <div
          className="progress-value"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function EmptyPage() {
  return (
    <div className="card empty-page">
      <div className="empty-icon">
        AI
      </div>

      <h2>
        No Inspection Result
      </h2>

      <p>
        Run an inspection first from the
        New Inspection page.
      </p>
    </div>
  );
}

function formatName(
  value
) {
  return value
    ? value.replaceAll(
        "_",
        " "
      )
    : "";
}

export default App;