package msgsender

import "testing"

func TestNormalizeE164(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"+5511987654321", "5511987654321", false},
		{"5511987654321", "5511987654321", false},
		{"11987654321", "5511987654321", false},
		{"(11) 98765-4321", "5511987654321", false},
		{"1134567890", "551134567890", false},
		{"", "", true},
		{"abc", "", true},
		{"12345", "", true},
		{"123456789012345678", "", true},
	}

	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			got, err := NormalizeE164(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Errorf("NormalizeE164(%q) expected error, got %q", tc.in, got)
				}
				return
			}
			if err != nil {
				t.Errorf("NormalizeE164(%q) err=%v", tc.in, err)
			}
			if got != tc.want {
				t.Errorf("NormalizeE164(%q)=%q want=%q", tc.in, got, tc.want)
			}
		})
	}
}
