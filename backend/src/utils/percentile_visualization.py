import argparse
import csv
import json
from tkinter.font import names
import numpy as np

def build_quartile_group(score: float) -> str:
    if score >= 0.5:
        return "Q4: 0.5-1.0"
    if score >= 0.0:
        return "Q3: 0.0-0.5"
    if score >= -0.5:
        return "Q2: (-0.5)-0.0"
    return "Q1: (-1.0)-(-0.5)"

# 
# Before using this function, set use_cohort = false in JobRecommendations.jsx and api.js to view individual scoring   
def create_boxplot(scores: np.ndarray, names: np.ndarray, percentile_threshold: float, output_html: str) -> None:
    """
    Create an interactive browser-based visualization displaying candidate-job match similarity scores.

    Features:
    - Boxplot showing score distribution with quartiles
    - Color-coded data points by score ranges (Q1-Q4)
    - Red rectangle highlighting top x% (default to 25%) of candidates based on percentile threshold (75th percentile)
    - Interactive hover tooltips displaying candidate names and similarity scores

    Args:
        scores: Array of cosine similarity scores for candidates (typically -1 to 1 range)
        names: Array of candidate names corresponding to the scores
        percentile_threshold: Threshold value (0-1) for determining top performers (default 0.75)
        output_html: File path where the interactive HTML visualization will be saved

    Returns:
        None: Saves the visualization as an HTML file that can be opened in any web browser

    Raises:
        RuntimeError: If 'plotly' is not installed (required for visualization generation)
    """
    try:
        import plotly.graph_objects as go
    except Exception as exc:
        raise RuntimeError("plotly is required to generate the boxplot HTML.") from exc

    if scores.size == 0 or names.size == 0:
        return

    # Define colors for score groups
    color_map = {
        'Q4: 0.5-1.0': '#27ae60',      # Dark Green (top quartile)
        'Q3: 0.0-0.5': '#0dd8ce',      # Teal
        'Q2: (-0.5)-0.0': '#eacf02',     # Yellow
        'Q1: (-1.0)-(-0.5)': '#da4636'     # Red (bottom quartile)
    }

    # Define the ORDER for legend (high to low)
    group_order = ['Q4: 0.5-1.0', 'Q3: 0.0-0.5', 'Q2: (-0.5)-0.0', 'Q1: (-1.0)-(-0.5)']

    fig = go.Figure()

    # Add boxplot
    fig.add_trace(go.Box(
        x=[0],  # Set x to a numerical value to align with jitter
        y=scores,
        name='',
        boxmean=False,
        marker=dict(color='lightblue', opacity=0.8),
        line=dict(color='gray'),
        fillcolor='lightblue',
        opacity=0.8,
        width=0.5,
        showlegend=False,
        hoverinfo='skip'
    ))

    # Calculate quartiles for the red box
    q3 = float(np.quantile(scores, percentile_threshold))
    max_val = float(np.max(scores))
    center_y = q3 + (max_val - q3) / 2

    # Add red rectangle for top 25%
    fig.add_shape(
        type="rect",
        x0=-0.25, x1=0.25,
        y0=q3, y1=max_val,
        line=dict(color="red", width=2),
        fillcolor="rgba(255, 0, 0, 0)",
        opacity=0.3
    )

    # Add "Top 25%" label
    fig.add_annotation(
        x=0.35, y=center_y,
        text="Top 25%",
        showarrow=False,
        font=dict(color="red", size=11, family="Arial Black"),
        xanchor="left"
    )

    # Add colored data points with jitter
    np.random.seed(42)
    quartile_groups = np.array([build_quartile_group(score) for score in scores])
    jitter = np.random.normal(0, 0.06, size=len(scores))

    for group in group_order:
        mask = quartile_groups == group
        group_scores = scores[mask]
        group_names = names[mask]

        if len(group_scores) == 0:
            fig.add_trace(go.Scatter(
                x=[],
                y=[],
                mode='markers',
                name=group,
                marker=dict(
                    size=12,
                    color=color_map[group],
                    line=dict(color='white', width=1)
                ),
                showlegend=True
            ))
            continue

        hover_data = []
        hover_template = ''

        if group_names is not None:
            hover_data.append(group_names)
            hover_data.append(group_scores)
            hover_template = 'Candidate: %{customdata[0]}<br>'
            hover_template += 'Match Score: %{customdata[1]:.3f}<br><extra></extra>'
        else:
            hover_data.append(group_scores)
            hover_template = 'Match Score: %{customdata[0]:.3f}<br><extra></extra>'

        fig.add_trace(go.Scatter(
            x=jitter,
            y=group_scores,
            mode='markers',
            name=group,
            marker=dict(
                size=12,
                color=color_map[group],
                line=dict(color='white', width=1)
            ),
            customdata=np.column_stack(hover_data),
            hovertemplate=hover_template
        ))

    fig.update_layout(
        title=dict(
            text=f'Boxplot with Score-Range-Colored Data Points<br><sub style="color:red; font-size:12px">75th percentile threshold: {q3:.3f}</sub>',
            font=dict(size=14, family="Arial Black")
        ),
        yaxis=dict(
            title='Cosine Similarity Score',
            range=[-1, 1.08],
            gridcolor='rgba(128, 128, 128, 0.3)'
        ),
        xaxis=dict(
            range=[-0.6, 0.6],
            showticklabels=False,
            showgrid=False
        ),
        legend=dict(
            title='Score Range',
            x=1.02,
            y=0.98,
            xanchor='left',
            bgcolor='rgba(255, 255, 255, 0.8)',
            bordercolor='black',
            borderwidth=1
        ),
        plot_bgcolor='white',
        width=800,
        height=600
    )

    # Add reference line at 0 if data includes negative values
    if np.min(scores) < 0:
        fig.add_hline(
            y=0,
            line_dash="dash",
            line_color="red",
            opacity=0.3,
            line_width=1
        )

    fig.write_html(output_html)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a score boxplot HTML report from a 'candidates' list. Input a JSON file containing a 'candidates' key with a list of records, each having a score and candidate name.")
    parser.add_argument("--input-json", required=True, help="Path to JSON with a 'candidates' key containing a list of records.")
    parser.add_argument("--output-html", default="scores_boxplot.html", help="Output HTML path.")
    parser.add_argument("--score-column", default="score", help="Name of the score column in the input JSON.")
    parser.add_argument("--name-column", default="full_name", help="Name of the candidate name column for hover labels.")
    parser.add_argument("--percentile-threshold", type=float, default=0.75, help="Percentile threshold for highlighting top scores (default: 0.75 for top 25%).")
    args = parser.parse_args()

    scores_list: list[float] = []
    names_list: list[str] = []

    with open(args.input_json, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        data = raw_data.get('candidates', [])

        # Validate that the loaded data is a list of dictionaries as expected.
        if not isinstance(data, list):
            raise TypeError("Expected JSON data to be a list of objects after extracting 'candidates'.")
        if not data:
            raise ValueError("Input JSON file is empty or does not contain any records after extracting 'candidates'.")

        if args.score_column not in data[0]:
            raise ValueError(f"Input JSON must contain a '{args.score_column}' column, likely nested under a 'scores' key.")
        if args.name_column not in data[0]:
            raise ValueError(f"Input JSON must contain a '{args.name_column}' column for hover labels.")
        
        for row in data:
            scores_list.append(float(row[args.score_column]))
            names_list.append(row.get(args.name_column) or "")

        scores_array = np.array(scores_list, dtype=float)
        names_array = np.array(names_list, dtype=str)
        create_boxplot(scores_array, names_array, args.percentile_threshold, args.output_html)
    print(f"Chart saved to {args.output_html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())