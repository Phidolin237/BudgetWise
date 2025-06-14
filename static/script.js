// Variables globales pour les graphiques
let depensesChart = null;
let evolutionChart = null;
const API_BASE_URL = '/api/operations';

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    chargerDonneesCompletes();
});

// Fonction principale pour charger toutes les données
async function chargerDonneesCompletes() {
    try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) throw new Error('Erreur réseau');
        
        const data = await response.json();
        console.log("Données reçues:", data);
        
        // Mettre à jour l'interface
        document.getElementById('solde').textContent = data.solde.toFixed(2);
        remplirTable('revenus', data.revenus);
        remplirTable('depenses', data.depenses);
        
        // Mettre à jour les graphiques
        updateCharts(data.revenus, data.depenses);
    } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur lors du chargement des données");
    }
}

// Fonctions pour les graphiques
function updateCharts(revenus, depenses) {
    // 1. Vérification des données
    if (!revenus || !depenses) {
        console.error("Données manquantes pour les graphiques");
        return;
    }
    
    // 2. Préparation données camembert
    const categories = {};
    depenses.forEach(d => {
        if (d.categorie) {
            categories[d.categorie] = (categories[d.categorie] || 0) + d.montant;
        }
    });

    // 3. Préparation données évolution
    const moisData = {};
    const allOperations = [...revenus, ...depenses.map(d => ({...d, montant: -d.montant}))];
    
    allOperations.forEach(op => {
        if (op.created_at) {
            const date = new Date(op.created_at);
            const mois = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            moisData[mois] = (moisData[mois] || 0) + op.montant;
        }
    });

    // 4. Création des graphiques
    createPieChart(Object.keys(categories), Object.values(categories));
    createLineChart(Object.keys(moisData).sort(), Object.values(moisData));
}

function createPieChart(labels, data) {
    const ctx = document.getElementById('depensesChart');
    if (!ctx) return console.error("Canvas non trouvé");

    // Vérification si des données existent
    if (labels.length === 0 || data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="no-data">Aucune donnée de dépenses disponible</p>';
        return;
    }

    if (depensesChart) depensesChart.destroy();
    
    depensesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#8AC24A', '#607D8B'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function createLineChart(labels, data) {
    const ctx = document.getElementById('evolutionChart');
    if (!ctx) return console.error("Canvas non trouvé");

    // Vérification si des données existent
    if (labels.length === 0 || data.length === 0) {
        ctx.parentElement.innerHTML = '<p class="no-data">Aucune donnée historique disponible</p>';
        return;
    }

    if (evolutionChart) evolutionChart.destroy();
    
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solde Mensuel',
                data: data,
                borderColor: '#4BC0C0',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Fonctions pour les tables (inchangées)
function remplirTable(tableId, operations) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    operations.forEach(op => {
        const row = document.createElement('tr');
        
        if (tableId === 'revenus') {
            row.innerHTML = `
                <td>${op.montant?.toFixed(2) || '0.00'} €</td>
                <td>${op.source || ''}</td>
                <td>
                    <button onclick="supprimerOperation('${op.id}', 'revenu')">Supprimer</button>
                    <button onclick="modifierOperation('${op.id}', 'revenu')">Modifier</button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${op.montant?.toFixed(2) || '0.00'} €</td>
                <td>${op.categorie || ''}</td>
                <td>
                    <button onclick="supprimerOperation('${op.id}', 'depense')">Supprimer</button>
                    <button onclick="modifierOperation('${op.id}', 'depense')">Modifier</button>
                </td>
            `;
        }
        
        tbody.appendChild(row);
    });
}

// Fonctions d'opérations (inchangées)
async function ajouterOperation() {
    const type = document.getElementById('type').value;
    const montant = parseFloat(document.getElementById('montant').value);
    const description = document.getElementById('description').value;
    
    if (!montant || !description) {
        alert("Veuillez remplir tous les champs");
        return;
    }
    
    const operationData = {
        type: type,
        montant: montant,
        ...(type === 'revenu' ? { source: description } : { categorie: description })
    };
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(operationData)
        });
        
        if (!response.ok) throw new Error(await response.text());
        
        chargerDonneesCompletes();
        document.getElementById('montant').value = '';
        document.getElementById('description').value = '';
    } catch (error) {
        console.error("Erreur:", error);
        alert(error.message);
    }
}

async function supprimerOperation(id, type) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette opération ?")) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("Échec de la suppression");
        chargerDonneesCompletes();
    } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur lors de la suppression");
    }
}

async function modifierOperation(id, type) {
    const nouveauMontant = parseFloat(prompt("Nouveau montant :") || 0);
    const nouveauChamp = prompt(type === 'revenu' ? "Nouvelle source :" : "Nouvelle catégorie :");
    
    if (!nouveauChamp) return;
    
    const updateData = {
        montant: nouveauMontant,
        ...(type === 'revenu' ? { source: nouveauChamp } : { categorie: nouveauChamp })
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) throw new Error("Échec de la modification");
        chargerDonneesCompletes();
    } catch (error) {
        console.error("Erreur:", error);
        alert("Erreur lors de la modification");
    }
}