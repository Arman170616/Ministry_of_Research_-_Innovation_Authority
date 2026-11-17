from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from . import ai

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


@patch('research.ai.is_enabled', return_value=False)  # keyword matching; never call the real API in tests
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

    def test_create_proposal_sets_owner_and_numbers(self, _ai_off):
        p = self.make_proposal()
        self.assertEqual(p['user_id'], self.alice.id)
        self.assertEqual(p['funding_requested'], 25000.5)
        self.assertEqual(p['status'], 'pending')

    def test_proposals_are_private_to_owner(self, _ai_off):
        p = self.make_proposal()
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get('/api/proposals/').data, [])
        self.assertEqual(self.client.get(f"/api/proposals/{p['id']}/").status_code, 404)

    def test_staff_see_all_proposals(self, _ai_off):
        self.make_proposal()
        self.bob.is_staff = True
        self.bob.save()
        self.client.force_authenticate(self.bob)
        self.assertEqual(len(self.client.get('/api/proposals/').data), 1)

    def test_matching_for_one_proposal(self, _ai_off):
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

    def test_regenerating_keeps_review_status(self, _ai_off):
        p = self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.assertEqual(self.client.post('/api/matches/generate/', {}, format='json').data, {'count': 1, 'method': 'keyword', 'warning': None})
        match_id = Match.objects.get().id
        res = self.client.patch(f'/api/matches/{match_id}/', {'status': 'accepted', 'notes': 'Good fit'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.post('/api/matches/generate/', {}, format='json')
        self.assertEqual(Match.objects.get().status, 'accepted')
        self.assertEqual(Match.objects.count(), 1)
        self.assertEqual(Proposal.objects.get(pk=p['id']).matches.count(), 1)

    def test_match_score_cannot_be_edited(self, _ai_off):
        self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.client.post('/api/matches/generate/', {}, format='json')
        m = Match.objects.get()
        self.client.patch(f'/api/matches/{m.id}/', {'match_score': 99}, format='json')
        m.refresh_from_db()
        self.assertEqual(m.match_score, 20)

    def test_deleting_proposal_deletes_its_matches(self, _ai_off):
        p = self.make_proposal()
        self.client.post('/api/publications/', {'title': 'Paper', 'authors': 'X', 'keywords': ['energy']}, format='json')
        self.client.post('/api/matches/generate/', {}, format='json')
        self.assertEqual(self.client.delete(f"/api/proposals/{p['id']}/").status_code, 204)
        self.assertEqual(Match.objects.count(), 0)
        self.assertEqual(Publication.objects.count(), 1)

    def test_evaluation_is_upserted_per_user(self, _ai_off):
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

    def test_cannot_evaluate_someone_elses_proposal(self, _ai_off):
        p = self.make_proposal()
        self.client.force_authenticate(self.bob)
        res = self.client.post('/api/evaluations/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_evaluation_scores_validated(self, _ai_off):
        p = self.make_proposal()
        res = self.client.post('/api/evaluations/', {'proposal_id': p['id'], 'a_scores': [11]}, format='json')
        self.assertEqual(res.status_code, 400)



class AITests(APITestCase):
    """AI endpoints with Claude's answers simulated (no network calls)."""

    def setUp(self):
        self.user = User.objects.create_user(username='rev', email='rev@x.com', password=STRONG_PASSWORD)
        self.client.force_authenticate(self.user)
        self.pub = Publication.objects.create(title='ML for desalination', authors='X', keywords=['desalination'])
        self.other = Publication.objects.create(title='Forts', authors='Y', keywords=['heritage'])

    def make_proposal(self):
        return self.client.post('/api/proposals/', {
            'title': 'Solar desalination', 'author': 'Dr. A', 'keywords': ['desalination'],
            'document_text': 'Full proposal text.'}, format='json').data

    @patch('research.ai.is_enabled', return_value=True)
    @patch('research.ai._ask')
    def test_extract_pdf(self, ask, _on):
        ask.return_value = {
            'is_research_proposal': True, 'title': 'Solar Desalination', 'author': 'Dr. A', 'author_email': '',
            'institution': 'SQU', 'research_area': 'Water Resources', 'abstract': 'Short.', 'funding_requested': 72000,
            'publication_date': '2026-09-01', 'keywords': ['Desalination', 'desalination', 'Solar Energy'],
            'missing_fields': ['author_email'],
        }
        upload = SimpleUploadedFile('proposal.pdf', b'%PDF-1.4 not really a pdf', content_type='application/pdf')
        res = self.client.post('/api/ai/extract/', {'file': upload}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['keywords'], ['desalination', 'solar energy'])  # lowercased, de-duplicated
        self.assertEqual(res.data['funding_requested'], 72000)
        self.assertIn('document_text', res.data)

    @patch('research.ai.is_enabled', return_value=True)
    def test_extract_rejects_word_files(self, _on):
        upload = SimpleUploadedFile('proposal.docx', b'data')
        res = self.client.post('/api/ai/extract/', {'file': upload}, format='multipart')
        self.assertEqual(res.status_code, 503)
        self.assertIn('PDF or TXT', res.data['detail'])

    def test_document_text_is_stored_but_not_listed(self):
        p = self.make_proposal()
        self.assertNotIn('document_text', p)
        self.assertEqual(Proposal.objects.get(pk=p['id']).document_text, 'Full proposal text.')

    @patch('research.ai.is_enabled', return_value=True)
    @patch('research.ai._ask')
    def test_ai_matching_stores_reason_and_drops_low_scores(self, ask, _on):
        p = self.make_proposal()
        ask.return_value = {'matches': [
            {'publication_id': str(self.pub.id), 'score': 85, 'shared_topics': ['Desalination'], 'reason': 'Same method.'},
            {'publication_id': str(self.other.id), 'score': 5, 'shared_topics': [], 'reason': 'Unrelated.'},
            {'publication_id': 'not-a-real-id', 'score': 90, 'shared_topics': [], 'reason': 'Invented.'},
        ]}
        res = self.client.post('/api/matches/generate/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['X-Match-Method'], 'ai')
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['match_score'], 85)
        self.assertEqual(res.data[0]['rationale'], 'Same method.')
        self.assertEqual(res.data[0]['matched_keywords'], ['desalination'])

    @patch('research.ai.is_enabled', return_value=True)
    @patch('research.ai._ask', side_effect=ai.AIError('service down'))
    def test_matching_falls_back_to_keywords(self, _ask, _on):
        p = self.make_proposal()
        res = self.client.post('/api/matches/generate/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res['X-Match-Method'], 'keyword')
        self.assertIn('service down', res['X-Match-Warning'])
        self.assertEqual([m['publication']['title'] for m in res.data], ['ML for desalination'])

    @patch('research.ai.is_enabled', return_value=True)
    @patch('research.ai._ask')
    def test_evaluation_suggestion_is_padded_and_clamped(self, ask, _on):
        p = self.make_proposal()
        ask.return_value = {
            'a': [{'score': 12, 'reason': 'r'}] * 3,  # too few entries and out of range
            'b': [{'score': 7, 'reason': 'r'}] * 11, 'c': [{'score': 0, 'reason': 'r'}] * 9,
            'scientific_capacity': 8, 'leadership': 7, 'team_size': 4, 'recommendation': 'recommend',
            'summary': 'Good.', 'strengths': ['s'], 'weaknesses': ['w'],
        }
        res = self.client.post('/api/ai/evaluate/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(res.data['a']), 8)
        self.assertEqual(res.data['a'][0]['score'], 10)
        self.assertEqual(res.data['a'][7]['score'], 5)
        self.assertEqual(len(res.data['c']), 6)
        self.assertEqual(res.data['c'][0]['score'], 1)
        self.assertEqual(res.data['recommendation'], 'recommend')

    @patch('research.ai.is_enabled', return_value=False)
    def test_ai_off_reports_clear_error(self, _off):
        p = self.make_proposal()
        res = self.client.post('/api/ai/evaluate/', {'proposal_id': p['id']}, format='json')
        self.assertEqual(res.status_code, 503)
        self.assertIn('ANTHROPIC_API_KEY', res.data['detail'])
