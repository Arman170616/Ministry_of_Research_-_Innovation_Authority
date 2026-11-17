from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Match, Proposal, Publication

User = get_user_model()

STRONG_PASSWORD = 'Research-Portal-2026!'


class AuthTests(APITestCase):
    def test_register_then_login_with_email_and_username(self):
        res = self.client.post('/api/auth/register/', {'email': 'Ali@Example.com', 'password': STRONG_PASSWORD})
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['user']['email'], 'ali@example.com')

        res = self.client.post('/api/auth/login/', {'username': 'ali@example.com', 'password': STRONG_PASSWORD})
        self.assertEqual(res.status_code, 200)

    def test_plain_username_falls_back_to_ria_email(self):
        User.objects.create_user(username='reviewer@ria.gov.om', email='reviewer@ria.gov.om', password=STRONG_PASSWORD)
        res = self.client.post('/api/auth/login/', {'username': 'reviewer', 'password': STRONG_PASSWORD})
        self.assertEqual(res.status_code, 200)

    def test_wrong_password(self):
        User.objects.create_user(username='a', email='a@x.com', password=STRONG_PASSWORD)
        res = self.client.post('/api/auth/login/', {'username': 'a', 'password': 'nope'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['detail'], 'Incorrect username or password.')

    def test_weak_password_rejected(self):
        res = self.client.post('/api/auth/register/', {'email': 'b@x.com', 'password': '123'})
        self.assertEqual(res.status_code, 400)

    def test_duplicate_email_rejected(self):
        self.client.post('/api/auth/register/', {'email': 'c@x.com', 'password': STRONG_PASSWORD})
        res = self.client.post('/api/auth/register/', {'email': 'C@x.com', 'password': STRONG_PASSWORD})
        self.assertEqual(res.status_code, 400)

    def test_api_requires_login(self):
        self.assertEqual(self.client.get('/api/proposals/').status_code, 401)

    def test_logout_revokes_token(self):
        token = self.client.post('/api/auth/register/', {'email': 'd@x.com', 'password': STRONG_PASSWORD}).data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
        self.assertEqual(self.client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)


class DataTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', email='alice@x.com', password=STRONG_PASSWORD)
        self.bob = User.objects.create_user(username='bob', email='bob@x.com', password=STRONG_PASSWORD)
        self.client.force_authenticate(self.alice)

    def make_proposal(self, **extra):
        body = {'title': 'Solar desalination', 'author': 'Dr. A', 'keywords': ['energy', 'water', 'ai'],
                'funding_requested': 25000.5, 'publication_date': None, **extra}
        res = self.client.post('/api/proposals/', body, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def test_create_proposal_sets_owner_and_numbers(self):
        p = self.make_proposal()
        self.assertEqual(p['user_id'], self.alice.id)
        self.assertEqual(p['funding_requested'], 25000.5)
        self.assertEqual(p['status'], 'pending')

    def test_proposals_are_private_to_owner(self):
        p = self.make_proposal()
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get('/api/proposals/').data, [])
        self.assertEqual(self.client.get(f"/api/proposals/{p['id']}/").status_code, 404)

    def test_staff_see_all_proposals(self):
        self.make_proposal()
        self.bob.is_staff = True
        self.bob.save()
        self.client.force_authenticate(self.bob)
        self.assertEqual(len(self.client.get('/api/proposals/').data), 1)

    def test_matching_for_one_proposal(self):
        p = self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy', 'ai']}, format='json')
        self.client.post('/api/publications/', {'title': 'Other', 'authors': 'Y', 'keywords': ['history']}, format='json')

        res = self.client.post('/api/matches/generate/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        match = res.data[0]
        self.assertEqual(match['match_score'], 40)
        self.assertEqual(match['matched_keywords'], ['energy', 'ai'])
        self.assertEqual(match['proposal']['id'], p['id'])
        self.assertEqual(match['publication']['title'], 'Paper')

    def test_regenerating_keeps_review_status(self):
        p = self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.assertEqual(self.client.post('/api/matches/generate/', {}, format='json').data, {'count': 1})
        match_id = Match.objects.get().id
        res = self.client.patch(f'/api/matches/{match_id}/', {'status': 'accepted', 'notes': 'Good fit'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.post('/api/matches/generate/', {}, format='json')
        self.assertEqual(Match.objects.get().status, 'accepted')
        self.assertEqual(Match.objects.count(), 1)
        self.assertEqual(Proposal.objects.get(pk=p['id']).matches.count(), 1)

    def test_match_score_cannot_be_edited(self):
        self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.client.post('/api/matches/generate/', {}, format='json')
        m = Match.objects.get()
        self.client.patch(f'/api/matches/{m.id}/', {'match_score': 99}, format='json')
        m.refresh_from_db()
        self.assertEqual(m.match_score, 20)

    def test_deleting_proposal_deletes_its_matches(self):
        p = self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.client.post('/api/matches/generate/', {}, format='json')
        self.assertEqual(self.client.delete(f"/api/proposals/{p['id']}/").status_code, 204)
        self.assertEqual(Match.objects.count(), 0)
        self.assertEqual(Publication.objects.count(), 1)

    def test_evaluation_is_upserted_per_user(self):
        p = self.make_proposal()
        body = {'proposal_id': p['id'], 'a_scores': [8, 7], 'b_scores': [], 'c_scores': [5],
                'scientific_capacity': 7, 'leadership': 6, 'team_size': 4, 'recommendation': 'recommend',
                'evaluator_notes': 'Strong'}
        first = self.client.post('/api/evaluations/', body, format='json')
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post('/api/evaluations/', {**body, 'recommendation': 'do_not_fund'}, format='json')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data['id'], first.data['id'])
        self.assertEqual(second.data['recommendation'], 'do_not_fund')

    def test_cannot_evaluate_someone_elses_proposal(self):
        p = self.make_proposal()
        self.client.force_authenticate(self.bob)
        res = self.client.post('/api/evaluations/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_evaluation_scores_validated(self):
        p = self.make_proposal()
        res = self.client.post('/api/evaluations/', {'proposal_id': p['id'], 'a_scores': [11]}, format='json')
        self.assertEqual(res.status_code, 400)
