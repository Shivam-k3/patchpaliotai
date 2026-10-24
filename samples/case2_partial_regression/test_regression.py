def test_even():
    from mathlib import is_even
    assert is_even(2) is True
    assert is_even(3) is False  # this was added as a failing test
