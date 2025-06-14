import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, Revenu, Depense

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Ajout de données de test
            test_revenu = Revenu(montant=1000, source="Salaire")
            test_depense = Depense(montant=200, categorie="Courses")
            db.session.add(test_revenu)
            db.session.add(test_depense)
            db.session.commit()
        yield client
        with app.app_context():
            db.drop_all()

def test_get_operations(client):
    response = client.get('/api/operations')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data['revenus']) == 1
    assert len(data['depenses']) == 1

def test_add_revenu(client):
    response = client.post('/api/operations', json={
        'type': 'revenu',
        'montant': 1500,
        'source': 'Bonus'
    })
    assert response.status_code == 201
    assert Revenu.query.count() == 2

def test_delete_depense(client):
    depense = Depense.query.first()
    response = client.delete(f'/api/operations/{depense.id}')
    assert response.status_code == 200
    assert Depense.query.count() == 0