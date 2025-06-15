from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
# Initialisation de l'application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(app.root_path, 'budget.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
# Modèles de données améliorés
class OperationBase:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    def to_dict(self):
        return {
            'id': self.id,
            'montant': self.montant,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
class Revenu(db.Model, OperationBase):
    id = db.Column(db.Integer, primary_key=True)
    montant = db.Column(db.Float, nullable=False)
    source = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    def to_dict(self):
        base_dict = super().to_dict()
        base_dict.update({
            'type': 'revenu',
            'source': self.source,
            'description': self.description
        })
        return base_dict
class Depense(db.Model, OperationBase):
    id = db.Column(db.Integer, primary_key=True)
    montant = db.Column(db.Float, nullable=False)
    categorie = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text)
    def to_dict(self):
        base_dict = super().to_dict()
        base_dict.update({
            'type': 'depense',
            'categorie': self.categorie,
            'notes': self.notes
        })
        return base_dict
# Initialisation de la base de données
def init_db():
    with app.app_context():
        db.drop_all()
        db.create_all()
        # Ajout de données de test (optionnel)
        test_revenu = Revenu(montant=3000, source="Salaire", description="Salaire mensuel")
        test_depense = Depense(montant=150, categorie="Épicerie", notes="Courses hebdomadaires")
        db.session.add(test_revenu)
        db.session.add(test_depense)
        db.session.commit()
# Routes API
@app.route('/api/operations', methods=['GET'])
def get_operations():
    """Récupère toutes les opérations avec pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    revenus = Revenu.query.order_by(Revenu.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    depenses = Depense.query.order_by(Depense.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'revenus': [r.to_dict() for r in revenus.items],
        'depenses': [d.to_dict() for d in depenses.items],
        'total_revenus': revenus.total,
        'total_depenses': depenses.total,
        'solde': sum(r.montant for r in Revenu.query.all()) - sum(d.montant for d in Depense.query.all())
    })  # Correction ici : la parenthèse de jsonify est maintenant correctement fermée.
@app.route('/api/operations', methods=['POST'])
def create_operation():
    """Crée une nouvelle opération (revenu ou dépense)"""
    data = request.get_json()
    if not data or 'type' not in data:
        return jsonify({'error': 'Type manquant (revenu/depense)'}), 400
    try:
        if data['type'] == 'revenu':
            operation = Revenu(
                montant=float(data['montant']),
                source=data.get('source', 'Non spécifié'),
                description=data.get('description')
            )
        elif data['type'] == 'depense':
            operation = Depense(
                montant=float(data['montant']),
                categorie=data.get('categorie', 'Divers'),
                notes=data.get('notes')
            )
        else:
            return jsonify({'error': 'Type invalide'}), 400
        db.session.add(operation)
        db.session.commit()
        return jsonify(operation.to_dict()), 201
    except ValueError:
        return jsonify({'error': 'Montant invalide'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/operations/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def manage_operation(id):
    """Gère une opération spécifique"""
    # Trouve l'opération (revenu ou dépense)
    operation = Revenu.query.get(id) or Depense.query.get(id)
    if not operation:
        return jsonify({'error': 'Opération non trouvée'}), 404
    if request.method == 'GET':
        return jsonify(operation.to_dict())
    elif request.method == 'PUT':
        data = request.get_json()
        try:
            if 'montant' in data:
                operation.montant = float(data['montant'])
            if isinstance(operation, Revenu):
                if 'source' in data: operation.source = data['source']
                if 'description' in data: operation.description = data['description']
            else:
                if 'categorie' in data: operation.categorie = data['categorie']
                if 'notes' in data: operation.notes = data['notes']
            db.session.commit()
            return jsonify(operation.to_dict())
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    elif request.method == 'DELETE':
        db.session.delete(operation)
        db.session.commit()
        return jsonify({'message': 'Opération supprimée'}), 200
# Route pour l'interface web
@app.route('/')
def index():
    return render_template('index.html')
# Commandes CLI utiles
@app.cli.command('initdb')
def initdb_command():
    """Initialise la base de données"""
    init_db()
    print('Base de données initialisée')
if __name__ == '__main__':
    app.run(debug=True)