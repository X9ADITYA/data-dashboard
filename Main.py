from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import plotly.express as px
import uvicorn
from typing import Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def validate_and_convert_data(df: pd.DataFrame, x_col: str, y_col: str) -> pd.DataFrame:
    """Enhanced data validation and conversion"""
    # Convert y-axis to numeric
    if y_col:
        df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
    
    # Drop rows with invalid data
    df = df.dropna(subset=[x_col, y_col] if y_col else [x_col])
    return df

def apply_aggregation(df: pd.DataFrame, x_col: str, y_col: str, agg_type: str) -> pd.DataFrame:
    """Safe aggregation with validation"""
    if agg_type == "sum":
        return df.groupby(x_col)[y_col].sum().reset_index()
    elif agg_type == "count":
        return df.groupby(x_col)[y_col].count().reset_index()
    elif agg_type == "average":
        return df.groupby(x_col)[y_col].mean().reset_index()
    elif agg_type == "distinct_count":
        return df.groupby(x_col)[y_col].nunique().reset_index()
    return df

@app.post("/generate-chart")
async def generate_chart(request: Request) -> Dict[str, Any]:
    try:
        req = await request.json()
        df = pd.DataFrame(req["data"])
        
        # Validate columns
        if req["x_column"] not in df.columns:
            raise HTTPException(status_code=400, detail=f"X-axis column '{req['x_column']}' not found")
        
        # Pie chart specific handling
        if req["chart_type"] == "pie":
            if "y_column" not in req or req["y_column"] not in df.columns:
                raise HTTPException(status_code=400, detail="Pie chart requires a values column")
            
            df = validate_and_convert_data(df, req["x_column"], req["y_column"])
            fig = px.pie(
                df,
                names=req["x_column"],
                values=req["y_column"],
                title=f"Distribution of {req['y_column']} by {req['x_column']}"
            )
            return {"success": True, "chart": fig.to_json()}
        
        # For other chart types
        if "y_column" not in req or req["y_column"] not in df.columns:
            raise HTTPException(status_code=400, detail=f"Y-axis column '{req.get('y_column', '')}' not found")
        
        df = validate_and_convert_data(df, req["x_column"], req["y_column"])
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No valid data remaining after filtering")
        
        if "agg_type" in req:
            df = apply_aggregation(df, req["x_column"], req["y_column"], req["agg_type"])

        chart_config = {
            "bar": px.bar,
            "line": px.line,
            "scatter": px.scatter,
            "area": px.area,
            "histogram": px.histogram
        }
        
        if req["chart_type"] not in chart_config:
            raise HTTPException(status_code=400, detail=f"Invalid chart type: {req['chart_type']}")
        
        fig = chart_config[req["chart_type"]](
            df,
            x=req["x_column"],
            y=req["y_column"],
            title=f"{req.get('agg_type', '').title()} of {req['y_column']} by {req['x_column']}"
        )
            
        return {"success": True, "chart": fig.to_json()}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/generate-card")
async def generate_card(request: Request) -> Dict[str, Any]:
    try:
        req = await request.json()
        df = pd.DataFrame(req["data"])
        
        # Validate required columns
        if req["column"] not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{req['column']}' not found")
        
        # Convert to numeric
        df[req["column"]] = pd.to_numeric(df[req["column"]], errors='coerce')
        if df[req["column"]].isna().all():
            raise HTTPException(status_code=400, detail="Column contains no numeric values")
        
        metadata = None
        value = None
        
        if req["agg_type"] == "sum":
            value = df[req["column"]].sum()
            title = f"Total {req['column']}"
        elif req["agg_type"] == "count":
            value = df[req["column"]].count()
            title = f"Count of {req['column']}"
        elif req["agg_type"] == "average":
            value = df[req["column"]].mean()
            title = f"Average {req['column']}"
        elif req["agg_type"] == "distinct_count":
            value = df[req["column"]].nunique()
            title = f"Unique {req['column']}"
        elif req["agg_type"] in ("max", "min"):
            if "reference_column" not in req:
                raise HTTPException(status_code=400, detail="Reference column required for max/min")
            if req["reference_column"] not in df.columns:
                raise HTTPException(status_code=400, detail=f"Reference column '{req['reference_column']}' not found")
            
            if req["agg_type"] == "max":
                value = df[req["column"]].max()
                max_row = df[df[req["column"]] == value].iloc[0]
                ref_value = max_row[req["reference_column"]]
                title = f"Max {req['column']}"
                metadata = {"reference_value": str(ref_value)}
            else:
                value = df[req["column"]].min()
                min_row = df[df[req["column"]] == value].iloc[0]
                ref_value = min_row[req["reference_column"]]
                title = f"Min {req['column']}"
                metadata = {"reference_value": str(ref_value)}
        else:  # raw value
            value = df[req["column"]].iloc[0] if len(df) > 0 else None
            title = f"{req['column']}"
            
        return {
            "success": True,
            "card": {
                "title": title,
                "value": f"{value:,.2f}" if isinstance(value, (int, float)) else str(value),
                "metadata": metadata
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    try:
        if file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file.file)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(file.file)
        else:
            return {"success": False, "error": "Only .xlsx, .xls, or .csv files allowed"}

        if df.empty:
            return {"success": False, "error": "The file is empty"}

        # Convert all potential numeric columns
        numeric_cols = []
        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col])
                numeric_cols.append(col)
            except:
                pass

        if not numeric_cols:
            return {"success": False, "error": "No numeric columns found for charts"}

        return {
            "success": True,
            "data": df.to_dict(orient="records"),
            "columns": {
                "all": list(df.columns),
                "numeric": numeric_cols
            }
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to process file: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)