// 加载各家总数数据并填充表格
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const tbody = document.querySelector('#managerTable tbody');
        data.forEach(item => {
            const row = `<tr><td>${item.year}</td><td>${item.month}</td><td>${item.ManagerShortName}</td><td>${item.record_count}</td></tr>`;
            tbody.innerHTML += row;
        });
    });

// 查询指定公司当月数据，并以表格形式展示
function queryCompanyData() {
    const company = document.getElementById('companyInput').value;
    fetch('monthlyData.json')
        .then(response => response.json())
        .then(data => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const results = data.filter(item => {
                if (!item.putOnRecordDate) return false;
                const date = new Date(Number(item.putOnRecordDate));
                const itemYear = date.getFullYear();
                const itemMonth = date.getMonth();
                // 计算距今几个月
                const monthsDiff = (currentYear - itemYear) * 12 + (currentMonth - itemMonth);
                return item.managerName.includes(company) && monthsDiff >= 0 && monthsDiff <= 2;
            });
            const resultsDiv = document.getElementById('queryResults');
            if (results.length === 0) {
                resultsDiv.innerHTML = "<p>未查询到相关数据</p>";
                return;
            }
            let tableHtml = `
                <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>基金编码</th>
                            <th>基金名称</th>
                            <th>管理人名称</th>
                            <th>管理人类型</th>
                            <th>运作状态</th>
                            <th>备案日期</th>
                            <th>委托人名称</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            tableHtml += results.map(item => {
                // 转换 putOnRecordDate 为 yyyy-MM-dd 格式
                let date = '';
                if (item.putOnRecordDate) {
                    const d = new Date(Number(item.putOnRecordDate));
                    date = d.toISOString().split('T')[0];
                }
                return `
                    <tr>
                        <td>${item.fundNo || ''}</td>
                        <td>${item.fundName || ''}</td>
                        <td>${item.managerName || ''}</td>
                        <td>${item.managerType || ''}</td>
                        <td>${item.workingState || ''}</td>
                        <td>${date}</td>
                        <td>${item.mandatorName || ''}</td>
                    </tr>
                `;
            }).join('');
            tableHtml += `
                    </tbody>
                </table>
            `;
            resultsDiv.innerHTML = tableHtml;
        });
}
// 下载表格为CSV的函数
function downloadTableAsCSV() {
    const table = document.getElementById('managerTable');
    let csv = '';
    for (let row of table.rows) {
        let rowData = [];
        for (let cell of row.cells) {
            rowData.push('"' + cell.innerText.replace(/"/g, '""') + '"');
        }
        csv += rowData.join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manager_table.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 分页相关变量
let currentPage = 1;
const itemsPerPage = 10;
let data = [];

// 加载数据并初始化表格
function loadData() {
    fetch('data.json')
        .then(response => response.json())
        .then(jsonData => {
            data = jsonData;
            renderTable();
            renderPagination();
        })
        .catch(error => console.error('Error loading data:', error));
}

// 渲染表格（当前页）
function renderTable() {
    const tbody = document.querySelector('#managerTable tbody');
    tbody.innerHTML = '';
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = data.slice(start, end);
    pageData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.year}</td>
            <td>${item.month}</td>
            <td>${item.ManagerShortName}</td>
            <td>${item.record_count}</td>
        `;
        tbody.appendChild(row);
    });
}

// 渲染分页控件
function renderPagination() {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(data.length / itemsPerPage);

    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    };
    paginationDiv.appendChild(prevBtn);

    // 当前页/总页数显示
    const pageInfo = document.createElement('span');
    pageInfo.style.margin = '0 10px';
    pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
    paginationDiv.appendChild(pageInfo);

    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    };
    paginationDiv.appendChild(nextBtn);
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    document.getElementById('downloadBtn').addEventListener('click', downloadTableAsCSV);
});
