import pandas as pd
import sqlalchemy
from config import SQL_PASSWORDS, SQL_HOST

engine = sqlalchemy.create_engine(
    f"mysql+pymysql://dev:{SQL_PASSWORDS}@{SQL_HOST}:3306/UpdatedData?charset=utf8"
)
with engine.connect() as connection:
    bench_basic_data = pd.read_sql_query(
        f"""SELECT 
                managerName,
                YEAR(rpi.putOnRecordDate) AS year,
                MONTH(rpi.putOnRecordDate) AS month,
                COUNT(*) AS record_count
            FROM 
                UpdatedData.raw_pfund_info rpi
            WHERE 
                rpi.putOnRecordDate >= '2025-08-01' 
            GROUP BY 
                managerName, 
                YEAR(rpi.putOnRecordDate),
                MONTH(rpi.putOnRecordDate)
            ORDER BY record_count DESC""",
        engine,
    )
bench_basic_data[bench_basic_data["record_count"] >= 5].to_json(
    "data.json", orient="records", force_ascii=False, indent=4
)

with engine.connect() as connection:
    p_info = pd.read_sql_query(
        f"""SELECT
            *
            from
                UpdatedData.raw_pfund_info rpi
            where
                rpi.putOnRecordDate >= "2025-08-01"
            order by
                rpi.putOnRecordDate""",
        engine,
    )
p_info[
    [
        "fundNo",
        "fundName",
        "managerName",
        "managerType",
        "workingState",
        "putOnRecordDate",
        "mandatorName",
    ]
].to_json("monthlyData.json", orient="records", force_ascii=False, indent=4)
