import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OTPCodeInput } from "./OTPCodeInput";

describe("OTPCodeInput", () => {
    it("renderiza 6 inputs", () => {
        render(<OTPCodeInput onComplete={() => {}} />);
        const inputs = screen.getAllByRole("textbox");
        expect(inputs).toHaveLength(6);
    });

    it("avança foco ao digitar um dígito", async () => {
        const user = userEvent.setup();
        render(<OTPCodeInput onComplete={() => {}} />);
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
        inputs[0].focus();
        await user.keyboard("1");
        expect(inputs[0].value).toBe("1");
        expect(document.activeElement).toBe(inputs[1]);
    });

    it("distribui 6 dígitos em paste", async () => {
        const user = userEvent.setup();
        const onComplete = vi.fn();
        render(<OTPCodeInput onComplete={onComplete} />);
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
        inputs[0].focus();
        await user.paste("123456");
        expect(inputs[0].value).toBe("1");
        expect(inputs[1].value).toBe("2");
        expect(inputs[2].value).toBe("3");
        expect(inputs[3].value).toBe("4");
        expect(inputs[4].value).toBe("5");
        expect(inputs[5].value).toBe("6");
        expect(onComplete).toHaveBeenCalledWith("123456");
    });

    it("dispara onComplete ao preencher os 6 dígitos sequencialmente", async () => {
        const user = userEvent.setup();
        const onComplete = vi.fn();
        render(<OTPCodeInput onComplete={onComplete} />);
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
        inputs[0].focus();
        await user.keyboard("123456");
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith("123456");
    });

    it("backspace em slot vazio volta foco e apaga o anterior", async () => {
        const user = userEvent.setup();
        render(<OTPCodeInput onComplete={() => {}} />);
        const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
        inputs[0].focus();
        await user.keyboard("12");
        expect(inputs[1].value).toBe("2");
        expect(document.activeElement).toBe(inputs[2]);
        await user.keyboard("{Backspace}");
        expect(inputs[1].value).toBe("");
        expect(document.activeElement).toBe(inputs[1]);
    });
});
